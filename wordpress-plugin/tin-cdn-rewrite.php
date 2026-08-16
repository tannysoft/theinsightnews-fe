<?php
/**
 * Plugin Name: Headless Helpers
 * Description: Six helpers for running WordPress headless behind a separate frontend — (1) optionally rewrites /wp-content/uploads/* URLs to a dedicated CDN host, (2) fires on-demand ISR revalidation on the frontend when a post is saved + exposes a manual "Clear cache" button in the editor, (3) makes admin "View Post" links point to the frontend while keeping REST / admin / login URLs on the origin, (4) ensures logged-in users with admin access actually land in wp-admin after login (fixes headless redirect-to-frontend bug), (5) 301-redirects public page views to the configured frontend host, leaving wp-admin / wp-json / login / uploads untouched, (6) exposes GET /wp-json/tin/v1/posts — the same query surface as /wp/v2/posts but with the featured image, author, terms and reading time inlined, so clients never need the heavyweight `_embed`. Site-agnostic — drop it into any WP install and configure via Settings → Headless.
 * Version: 1.9.0
 * License: GPL-2.0+
 *
 * How to install:
 *   1. Copy this file to `wp-content/plugins/tin-cdn-rewrite.php` (or any name).
 *   2. WP Admin → Plugins → activate "Headless Helpers".
 *   3. Settings → Headless → paste the revalidate secret (must match the
 *      frontend's REVALIDATE_SECRET). Optionally set a CDN target host.
 *
 * Design notes:
 *   - No domain is hardcoded. Frontend URL comes from WP's own `home_url()`
 *     (i.e. Settings → General → Site Address), admin/origin from `site_url()`.
 *     So this plugin works on any site: just set WP_HOME to the FE and
 *     WP_SITEURL to the admin — the plugin follows whatever those say.
 *   - Revalidate secret can be set either in Settings or via the
 *     `TIN_REVALIDATE_SECRET` constant in wp-config.php (constant wins).
 */

if (!defined('ABSPATH')) {
    exit;
}

/* =========================================================================
 * Config
 * ========================================================================= */

const TIN_OPTION_SECRET      = 'tin_revalidate_secret';
const TIN_OPTION_CDN_TARGET  = 'tin_cdn_target';
const TIN_OPTION_FE_REDIRECT = 'tin_frontend_redirect';
const TIN_OPTION_FE_URL      = 'tin_frontend_url';
const TIN_OPTION_FE_EXCLUDE  = 'tin_frontend_exclude';

function tin_revalidate_secret() {
    if (defined('TIN_REVALIDATE_SECRET') && TIN_REVALIDATE_SECRET) {
        return TIN_REVALIDATE_SECRET;
    }
    return get_option(TIN_OPTION_SECRET, '');
}

/** The origin where WP actually serves its files from (admin + uploads). */
function tin_origin_url() {
    return untrailingslashit(site_url());
}

/** The public frontend. Same as WP_HOME. */
function tin_frontend_url($path = '') {
    return home_url($path);
}

/** Revalidate endpoint on the frontend. */
function tin_revalidate_endpoint() {
    return home_url('/api/revalidate');
}

/**
 * Dedicated CDN host for /wp-content/uploads/* (optional). Empty → feature
 * disabled (rewrites become no-ops).
 */
function tin_cdn_target() {
    $t = trim((string) get_option(TIN_OPTION_CDN_TARGET, ''));
    return $t ? untrailingslashit($t) : '';
}

/** Whether public page views on the origin host get 301'd to the frontend. */
function tin_frontend_redirect_enabled() {
    return get_option(TIN_OPTION_FE_REDIRECT, '1') === '1';
}

/**
 * Where the frontend redirect actually points.
 *
 * Deliberately independent of `home_url()`: on a lot of headless installs
 * WP_HOME is left pointing at the WP origin (or gets reset by a migration
 * tool), and then a redirect derived from home_url() silently becomes a
 * no-op — the origin and the "frontend" resolve to the same host. Set this
 * explicitly and the redirect is unconditional.
 *
 * Resolution order: TIN_FRONTEND_URL constant → setting → home_url().
 */
function tin_frontend_target() {
    if (defined('TIN_FRONTEND_URL') && TIN_FRONTEND_URL) {
        return untrailingslashit(TIN_FRONTEND_URL);
    }
    $opt = trim((string) get_option(TIN_OPTION_FE_URL, ''));
    if ($opt) {
        return untrailingslashit($opt);
    }
    return untrailingslashit(home_url());
}

/* =========================================================================
 * 1) CDN URL rewrite
 * ========================================================================= */

/**
 * True when the current request originates from wp-admin. REST requests
 * fired by the block editor don't set `is_admin()`, so we additionally
 * check the Referer header.
 *
 * We skip CDN rewrites in this context so the editor sees original origin
 * URLs (which it can always load and validate) — only public consumers
 * (Next.js frontend, regular visitors) get the CDN-rewritten URLs.
 */
function tin_is_admin_context() {
    if (is_admin()) {
        return true;
    }
    if (defined('REST_REQUEST') && REST_REQUEST) {
        $referer = isset($_SERVER['HTTP_REFERER']) ? (string) $_SERVER['HTTP_REFERER'] : '';
        if ($referer && strpos($referer, admin_url()) === 0) {
            return true;
        }
    }
    return false;
}

function tin_cdn_rewrite($value) {
    if (!is_string($value) || $value === '') {
        return $value;
    }
    $target = tin_cdn_target();
    if (!$target) {
        return $value; // CDN host not configured — leave URLs as-is.
    }
    if (tin_is_admin_context()) {
        return $value; // Editor + admin UI always sees the origin URL.
    }
    $origin = tin_origin_url();
    if ($origin === $target) {
        return $value;
    }
    return str_replace(
        $origin . '/wp-content/uploads/',
        $target . '/wp-content/uploads/',
        $value
    );
}

function tin_cdn_rewrite_deep($data) {
    if (is_string($data)) {
        return tin_cdn_rewrite($data);
    }
    if (is_array($data)) {
        foreach ($data as $k => $v) {
            $data[$k] = tin_cdn_rewrite_deep($v);
        }
    }
    return $data;
}

add_filter('wp_get_attachment_url', 'tin_cdn_rewrite');

add_filter('wp_get_attachment_image_src', function ($image) {
    if (is_array($image) && !empty($image[0])) {
        $image[0] = tin_cdn_rewrite($image[0]);
    }
    return $image;
});

add_filter('wp_calculate_image_srcset', function ($sources) {
    if (!is_array($sources)) {
        return $sources;
    }
    foreach ($sources as $k => $s) {
        if (!empty($s['url'])) {
            $sources[$k]['url'] = tin_cdn_rewrite($s['url']);
        }
    }
    return $sources;
});

add_filter('the_content', 'tin_cdn_rewrite');
add_filter('the_excerpt', 'tin_cdn_rewrite');
add_filter('render_block', 'tin_cdn_rewrite');

add_filter('rest_prepare_attachment', function ($response) {
    if ($response instanceof WP_REST_Response) {
        $response->set_data(tin_cdn_rewrite_deep($response->get_data()));
    }
    return $response;
});
add_filter('rest_prepare_post', function ($response) {
    if ($response instanceof WP_REST_Response) {
        $response->set_data(tin_cdn_rewrite_deep($response->get_data()));
    }
    return $response;
});

/* =========================================================================
 * 2) ISR revalidation
 * ========================================================================= */

/**
 * POST page + layout paths to the FE revalidate endpoint. When $blocking is
 * false (the default), fire-and-forget so we never slow down the save flow.
 */
function tin_revalidate_paths(array $pagePaths, array $layoutPaths = [], $blocking = false) {
    $secret = tin_revalidate_secret();
    if (!$secret) {
        return new WP_Error('tin_no_secret', 'Revalidate secret not configured');
    }
    if (!$pagePaths && !$layoutPaths) {
        return new WP_Error('tin_no_paths', 'No paths to revalidate');
    }
    return wp_remote_post(tin_revalidate_endpoint(), [
        'headers' => [
            'Content-Type'        => 'application/json',
            'x-revalidate-secret' => $secret,
        ],
        'body'     => wp_json_encode([
            'paths'       => array_values($pagePaths),
            'layoutPaths' => array_values($layoutPaths),
        ]),
        'timeout'  => $blocking ? 10 : 0.1,
        'blocking' => (bool) $blocking,
    ]);
}

/**
 * Build the paths to invalidate for a given post: home + single + every
 * category/tag archive the post belongs to.
 *
 * Category/tag pages go in as "layout" so that their paginated children
 * (`/category/foo/page/2`, etc.) are flushed too.
 *
 * Returns ['page' => [...], 'layout' => [...]].
 */
function tin_paths_for_post($post) {
    $slug = $post && !empty($post->post_name) ? $post->post_name : '';
    // '/feed' is the site-wide RSS feed on the frontend — it lists the latest
    // posts, so a publish makes it stale exactly like the home page does.
    $page = array_values(array_filter(['/', '/feed', $slug ? '/' . $slug : null]));

    $layout = [];
    if ($post) {
        $cats = wp_get_post_categories($post->ID, ['fields' => 'all']);
        if (!is_wp_error($cats)) {
            foreach ($cats as $term) {
                if (!empty($term->slug)) {
                    $layout[] = '/category/' . $term->slug;
                }
            }
        }
        $tags = wp_get_post_tags($post->ID);
        if (!is_wp_error($tags)) {
            foreach ($tags as $term) {
                if (!empty($term->slug)) {
                    $layout[] = '/tag/' . $term->slug;
                }
            }
        }
    }

    return ['page' => $page, 'layout' => array_values(array_unique($layout))];
}

/**
 * Home + single post + every category/tag this post belongs to. Scheduled
 * posts publishing via cron also hit `transition_post_status`, so they'll
 * revalidate automatically.
 */
add_action('transition_post_status', function ($new_status, $old_status, $post) {
    if (!$post || $post->post_type !== 'post') {
        return;
    }
    if ($new_status !== 'publish' && $old_status !== 'publish') {
        return;
    }
    $paths = tin_paths_for_post($post);
    tin_revalidate_paths($paths['page'], $paths['layout'], false);
}, 10, 3);

/**
 * "Clear cache" button in the Publish metabox on the post edit screen.
 */
add_action('post_submitbox_misc_actions', function ($post) {
    if (!$post || $post->post_type !== 'post') {
        return;
    }
    $nonce = wp_create_nonce('tin_clear_cache');
    ?>
    <div class="misc-pub-section misc-pub-tin-cache">
        <span class="dashicons dashicons-update" style="color:#787c82;"></span>
        <span>Frontend cache:</span>
        <button type="button"
                class="button button-secondary"
                id="tin-clear-cache"
                data-post-id="<?php echo esc_attr($post->ID); ?>"
                style="margin-left:4px;">
            Clear cache
        </button>
        <span id="tin-clear-cache-result" style="margin-left:8px;"></span>
    </div>
    <script>
    (function () {
      const btn = document.getElementById('tin-clear-cache');
      const out = document.getElementById('tin-clear-cache-result');
      if (!btn) return;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        out.textContent = '…';
        const body = new FormData();
        body.append('action', 'tin_clear_cache');
        body.append('post_id', btn.dataset.postId);
        body.append('_wpnonce', <?php echo wp_json_encode($nonce); ?>);
        try {
          const r = await fetch(ajaxurl, { method: 'POST', body });
          const j = await r.json();
          if (j.success) {
            const all = [].concat(j.data.paths || [], j.data.layoutPaths || []);
            out.innerHTML = '<span style="color:#00a32a;">✓ cleared ' + all.length + ' paths</span>';
            out.title = all.join('\n');
          } else {
            out.innerHTML = '<span style="color:#d63638;">✗ ' + (j.data && j.data.error ? j.data.error : 'failed') + '</span>';
          }
        } catch (e) {
          out.innerHTML = '<span style="color:#d63638;">✗ ' + e.message + '</span>';
        } finally {
          btn.disabled = false;
        }
      });
    })();
    </script>
    <?php
});

/**
 * Gutenberg version of the Clear-cache button.
 *
 * Injected into the top-right toolbar of the block editor (next to the
 * "View post" icon) so it stays reachable even in fullscreen mode where the
 * classic publish metabox is hidden. Uses a React portal into the editor
 * header settings container, with a MutationObserver to handle the
 * container being rendered after our plugin registers.
 */
add_action('enqueue_block_editor_assets', function () {
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    if ($screen && $screen->post_type && $screen->post_type !== 'post') {
        return;
    }
    $handle = 'tin-clear-cache-editor';
    wp_register_script(
        $handle,
        '',
        ['wp-plugins', 'wp-edit-post', 'wp-element', 'wp-components', 'wp-data'],
        '1.2.0',
        true
    );
    wp_enqueue_script($handle);

    $config = 'window.tinClearCache = ' . wp_json_encode([
        'nonce'   => wp_create_nonce('tin_clear_cache'),
        'ajaxUrl' => admin_url('admin-ajax.php'),
    ]) . ';';

    $js = <<<'JS'
(function (wp) {
  if (!wp || !wp.plugins || !wp.element) return;
  var registerPlugin = wp.plugins.registerPlugin;
  var Button = wp.components.Button;
  var el = wp.element.createElement;
  var useState = wp.element.useState;
  var useEffect = wp.element.useEffect;
  var createPortal = wp.element.createPortal;
  var useSelect = wp.data.useSelect;

  // Toolbar container — the right-side button group that holds View,
  // Preview, Publish, sidebar toggle, etc. Class names vary across WP
  // versions, so we try several and fall back to a generic match.
  function findToolbar() {
    return (
      document.querySelector('.editor-header__settings') ||
      document.querySelector('.edit-post-header__settings') ||
      document.querySelector('[class*="header__settings"]')
    );
  }

  // Portal target. Creates a host <div> as the first child of the toolbar
  // so our button sits to the left of the existing buttons — visually next
  // to "View post".
  function useToolbarHost() {
    var s = useState(null);
    var host = s[0], setHost = s[1];
    useEffect(function () {
      function attach() {
        var container = findToolbar();
        if (!container) return false;
        var existing = container.querySelector('#tin-toolbar-host');
        if (existing) { setHost(existing); return true; }
        var h = document.createElement('div');
        h.id = 'tin-toolbar-host';
        h.style.display = 'inline-flex';
        h.style.alignItems = 'center';
        h.style.marginRight = '4px';
        container.insertBefore(h, container.firstChild);
        setHost(h);
        return true;
      }
      if (attach()) return;
      var observer = new MutationObserver(function () {
        if (attach()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      return function () { observer.disconnect(); };
    }, []);
    return host;
  }

  function ClearCacheToolbarButton() {
    var host = useToolbarHost();
    var s = useState({ loading: false, message: null, ok: null });
    var state = s[0], setState = s[1];
    var postId = useSelect(function (select) {
      return select('core/editor').getCurrentPostId();
    }, []);

    function run() {
      if (!postId) return;
      setState({ loading: true, message: null, ok: null });
      var body = new FormData();
      body.append('action', 'tin_clear_cache');
      body.append('post_id', postId);
      body.append('_wpnonce', window.tinClearCache.nonce);
      fetch(window.tinClearCache.ajaxUrl, {
        method: 'POST',
        body: body,
        credentials: 'same-origin'
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.success) {
            var all = [].concat(j.data.paths || [], j.data.layoutPaths || []);
            setState({
              loading: false, ok: true,
              message: '✓ cleared ' + all.length
            });
          } else {
            setState({
              loading: false, ok: false,
              message: '✗ ' + ((j.data && j.data.error) || 'failed')
            });
          }
          // Fade the status back to idle after a few seconds.
          setTimeout(function () {
            setState({ loading: false, message: null, ok: null });
          }, 4000);
        })
        .catch(function (e) {
          setState({ loading: false, ok: false, message: '✗ ' + e.message });
        });
    }

    if (!host) return null;

    var label = state.loading
      ? 'Clearing…'
      : state.message
        ? state.message
        : 'Clear cache';

    var color =
      state.ok === true  ? '#00a32a' :
      state.ok === false ? '#d63638' :
      undefined;

    return createPortal(
      el(Button, {
        variant: 'tertiary',
        isBusy: state.loading,
        disabled: state.loading || !postId,
        onClick: run,
        title: 'Clear frontend cache (KV + Cloudflare) for this post',
        style: color ? { color: color } : undefined
      }, label),
      host
    );
  }

  registerPlugin('tin-clear-cache', { render: ClearCacheToolbarButton });
})(window.wp);
JS;

    wp_add_inline_script($handle, $config . $js);
});

add_action('wp_ajax_tin_clear_cache', function () {
    check_ajax_referer('tin_clear_cache');
    if (!current_user_can('edit_posts')) {
        wp_send_json_error(['error' => 'forbidden'], 403);
    }
    $post_id = isset($_POST['post_id']) ? (int) $_POST['post_id'] : 0;
    $post = $post_id ? get_post($post_id) : null;
    if (!$post) {
        wp_send_json_error(['error' => 'post not found'], 400);
    }
    $paths = tin_paths_for_post($post);
    $res = tin_revalidate_paths($paths['page'], $paths['layout'], true);
    if (is_wp_error($res)) {
        wp_send_json_error(['error' => $res->get_error_message()], 500);
    }
    $code = wp_remote_retrieve_response_code($res);
    if ($code !== 200) {
        wp_send_json_error([
            'error' => 'HTTP ' . $code . ' — ' . wp_remote_retrieve_body($res),
        ], 500);
    }
    wp_send_json_success([
        'paths'       => $paths['page'],
        'layoutPaths' => $paths['layout'],
    ]);
});

/* =========================================================================
 * 3) Admin "View Post" links → frontend
 *
 * WP_HOME is already pointed at the FE so permalinks *should* come out right,
 * but we rewrite explicitly as a safety net — anything under the origin host
 * that isn't an admin / REST / asset path gets mapped to the public host.
 * ========================================================================= */

function tin_rewrite_to_frontend($url) {
    if (!is_string($url) || $url === '') {
        return $url;
    }
    $origin = tin_origin_url();
    $home   = untrailingslashit(tin_frontend_url());
    // Nothing to do when admin and public URL are the same host.
    if ($origin === $home) {
        return $url;
    }
    if (strpos($url, $origin) !== 0) {
        return $url;
    }
    $path = substr($url, strlen($origin));
    // Keep admin / login / API / static asset URLs pointed at the origin.
    if (preg_match('#^(/wp-admin|/wp-login|/wp-json|/wp-content|/wp-includes)#', $path)) {
        return $url;
    }
    return $home . $path;
}

add_filter('post_link', 'tin_rewrite_to_frontend', 99);
add_filter('page_link', 'tin_rewrite_to_frontend', 99);
add_filter('post_type_link', 'tin_rewrite_to_frontend', 99);
// Intentionally skip preview_post_link — preview needs the admin host + cookie.

/**
 * Counter-rewrite: when we're inside wp-admin, force REST API URLs back to
 * the origin host.
 *
 * In a headless setup WP_HOME points at the frontend, so core's
 * `rest_url()` builds URLs like `https://frontend.example.com/wp-json/...`.
 * The block editor then tries to call those from wp-admin and fails
 * because the frontend doesn't serve the REST API ("Could not retrieve the
 * featured image data", etc.). Inside admin we want REST calls to go
 * directly to WordPress at WP_SITEURL.
 */
add_filter('rest_url', function ($url) {
    if (!tin_is_admin_context()) {
        return $url;
    }
    $home = untrailingslashit(home_url());
    $site = untrailingslashit(site_url());
    if ($home === $site) {
        return $url;
    }
    if (strpos($url, $home) === 0) {
        return $site . substr($url, strlen($home));
    }
    return $url;
}, 99);

/* =========================================================================
 * 4) Login / admin redirect safety
 *
 * On headless installs:
 *   - WP_HOME     = public frontend  (home_url())
 *   - WP_SITEURL  = admin origin     (site_url())
 *
 * WordPress computes the post-login `redirect_to` using `home_url()` in a
 * few code paths (referer fallback, subscriber default, etc.), which can
 * push users who actually have admin access onto the frontend — where
 * wp-admin doesn't exist. And `wp_safe_redirect()` bounces admin-origin
 * URLs back to home if the admin host isn't in `allowed_redirect_hosts`.
 *
 * These two filters close both gaps.
 * ========================================================================= */

/**
 * Keep the admin origin host in the wp_safe_redirect() allow-list so
 * admin-dashboard redirects aren't silently downgraded to home_url.
 */
add_filter('allowed_redirect_hosts', function ($hosts) {
    $parts = wp_parse_url(tin_origin_url());
    if (!empty($parts['host']) && !in_array($parts['host'], (array) $hosts, true)) {
        $hosts[] = $parts['host'];
    }
    return $hosts;
});

/**
 * If the post-login redirect would land a logged-in user on the FE, but
 * they actually have at least `read` capability (i.e. any real WP user),
 * send them to the admin dashboard instead. Respects an explicit
 * redirect_to — only rewrites when redirect_to defaults to the FE home.
 */
add_filter('login_redirect', function ($redirect_to, $requested_redirect_to, $user) {
    if (!($user instanceof WP_User)) {
        return $redirect_to;
    }
    $origin = tin_origin_url();
    $home   = untrailingslashit(tin_frontend_url());
    if ($origin === $home) {
        return $redirect_to; // Not a split-host install, nothing to do.
    }

    $target         = (string) $redirect_to;
    $explicit       = !empty($requested_redirect_to);
    $target_is_home = $target !== '' && (
        $target === $home ||
        $target === $home . '/' ||
        strpos(rtrim($target, '/'), $home) === 0
    );

    // Only intervene when (a) the redirect defaults to the frontend home
    // without the user asking for that explicitly, and (b) the user can
    // actually use the admin.
    if (!$explicit && $target_is_home && user_can($user, 'read')) {
        // Editors/authors/admins go to the dashboard, subscribers to their
        // profile — matches WP defaults for a non-headless install.
        return user_can($user, 'edit_posts') ? admin_url() : admin_url('profile.php');
    }
    return $redirect_to;
}, 20, 3);

/**
 * Final safety net: if something up the chain has already rewritten the
 * admin host to the FE inside admin-context URLs, put it back.
 */
add_filter('admin_url', function ($url) {
    $origin = tin_origin_url();
    $home   = untrailingslashit(tin_frontend_url());
    if ($origin === $home || !is_string($url) || $url === '') {
        return $url;
    }
    if (strpos($url, $home . '/wp-admin') === 0) {
        return $origin . substr($url, strlen($home));
    }
    return $url;
}, 99);

add_filter('login_url', function ($url) {
    $origin = tin_origin_url();
    $home   = untrailingslashit(tin_frontend_url());
    if ($origin === $home || !is_string($url) || $url === '') {
        return $url;
    }
    if (strpos($url, $home . '/wp-login') === 0) {
        return $origin . substr($url, strlen($home));
    }
    return $url;
}, 99);

/* =========================================================================
 * 5) Redirect public requests → frontend host
 *
 * Anyone landing on e.g. https://cms.example.com/some-post is bounced to
 * https://www.example.com/some-post (301, query string preserved). The target
 * is configured explicitly (Settings → Headless, or the TIN_FRONTEND_URL
 * constant) rather than inferred from home_url().
 *
 * WordPress' own backend stays reachable on the origin: every `/wp-*` path
 * (wp-admin and everything under it, wp-json and every route under it,
 * wp-login.php, wp-content, wp-includes, wp-cron, plus renamed admin entry
 * points like /wp-backoffice), the real admin/REST/login paths as WordPress
 * itself reports them, xmlrpc, robots.txt and .well-known — as are non-GET
 * requests, previews and the customizer.
 * ========================================================================= */

/**
 * Path prefixes that must keep working on the WP origin host.
 *
 * Compared against the path *relative to the WP install root*, so a
 * subdirectory install (site_url() = https://cms.example.com/wp) works too.
 *
 * `/wp-` is deliberately a blanket match rather than a list of known files:
 * it covers wp-admin and every screen under it, wp-json and every route under
 * it, wp-login.php, wp-content, wp-includes, wp-cron.php, wp-signup.php — and
 * anything a plugin invents later, including renamed admin entry points like
 * /wp-backoffice. The trade-off is that a *post* whose slug starts with "wp-"
 * would not be redirected; that's the safer direction to fail in, and such a
 * slug can be handled with the `tin_frontend_redirect_excluded` filter.
 *
 * On top of that we derive the real admin / REST / login paths from WordPress
 * itself, so a custom REST prefix (`rest_url_prefix`) or a renamed login slug
 * from a security plugin is picked up even when it isn't `wp-` prefixed.
 */
function tin_backend_path_prefixes() {
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $prefixes = [
        '/wp-',
        '/xmlrpc.php',
        '/robots.txt',
        '/favicon.ico',
        '/.well-known',
    ];

    // Base path of the WP install, stripped from the derived URLs below so
    // everything is comparable to tin_current_request_path().
    $base = (string) wp_parse_url(site_url(), PHP_URL_PATH);
    $base = ($base && $base !== '/') ? untrailingslashit($base) : '';

    $derived = [];
    foreach (['admin_url', 'rest_url', 'wp_login_url'] as $fn) {
        if (!function_exists($fn)) {
            continue;
        }
        $path = (string) wp_parse_url($fn(), PHP_URL_PATH);
        if ($path === '') {
            continue;
        }
        if ($base !== '' && strpos($path, $base) === 0) {
            $path = substr($path, strlen($base));
        }
        $path = untrailingslashit($path);
        if ($path !== '' && $path !== '/') {
            $derived[] = $path;
        }
    }

    // Anything else the site owner wants kept on this host, one per line.
    $extra = (string) get_option(TIN_OPTION_FE_EXCLUDE, '');
    foreach (preg_split('/[\r\n,]+/', $extra) as $line) {
        $line = trim($line);
        if ($line === '') {
            continue;
        }
        $derived[] = untrailingslashit('/' . ltrim($line, '/'));
    }

    /**
     * Filter the list of path prefixes that never get redirected to the
     * frontend. Values are matched case-insensitively against the start of
     * the request path.
     */
    $cache = array_values(array_unique(
        apply_filters('tin_frontend_redirect_excluded', array_merge($prefixes, $derived))
    ));

    return $cache;
}

/** True when $path sits under one of the origin-only prefixes. */
function tin_is_backend_path($path) {
    $path = explode('?', (string) $path, 2)[0];
    if ($path === '') {
        return true;
    }
    foreach (tin_backend_path_prefixes() as $prefix) {
        if (stripos($path, $prefix) === 0) {
            return true;
        }
    }
    return false;
}

/**
 * The REQUEST_URI as it arrived, captured before anything can rewrite it.
 *
 * Login-hardening plugins (WPS Hide Login and friends) overwrite
 * `$_SERVER['REQUEST_URI']` on `plugins_loaded` with a decoy path — a run of
 * "-/" segments — so that a request for wp-login.php falls through to a 404
 * instead of the login form. By the time our `init` callback runs the request
 * no longer looks like /wp-login.php, and we'd bounce that decoy to the
 * frontend. Priming this at file-load time beats every `plugins_loaded`
 * callback regardless of plugin order.
 */
function tin_original_request_uri() {
    static $uri = '';
    // Only latch a non-empty value. Under SAPIs where REQUEST_URI isn't
    // populated at include time, freezing '' would make every page look like
    // '/' and send the whole site to the frontend root.
    if ($uri === '' && !empty($_SERVER['REQUEST_URI'])) {
        $uri = (string) $_SERVER['REQUEST_URI'];
    }
    return $uri !== '' ? $uri : '/';
}
tin_original_request_uri();

/**
 * A request path (with query string) relative to the WP install root.
 * Returns '' when the request doesn't live under the install root.
 */
function tin_request_path($uri = null) {
    if ($uri === null) {
        $uri = tin_original_request_uri();
    }
    $uri = (string) $uri;
    if ($uri === '') {
        $uri = '/';
    }
    $base = wp_parse_url(site_url(), PHP_URL_PATH);
    $base = $base ? untrailingslashit($base) : '';
    if ($base !== '' && $base !== '/') {
        if (strpos($uri, $base) !== 0) {
            return '';
        }
        $uri = substr($uri, strlen($base));
    }
    return $uri === '' ? '/' : $uri;
}

/** Back-compat alias. */
function tin_current_request_path() {
    return tin_request_path();
}

/**
 * True when this request must not be redirected — backend paths, non-GET
 * verbs, REST/AJAX/cron/CLI, previews and the customizer.
 */
function tin_skip_frontend_redirect($path) {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return true;
    }
    if (defined('REST_REQUEST') && REST_REQUEST) {
        return true;
    }
    if (defined('WP_CLI') && WP_CLI) {
        return true;
    }
    if (defined('XMLRPC_REQUEST') && XMLRPC_REQUEST) {
        return true;
    }
    // We run as early as `init`, before REST_REQUEST / DOING_CRON exist for
    // the query-string flavours of those endpoints — match them by param.
    if (isset($_GET['rest_route']) || isset($_GET['doing_wp_cron'])) {
        return true;
    }
    $method = isset($_SERVER['REQUEST_METHOD'])
        ? strtoupper((string) $_SERVER['REQUEST_METHOD'])
        : 'GET';
    if ($method !== 'GET' && $method !== 'HEAD') {
        return true;
    }
    // Check the URI as it arrived *and* as it stands now — either looking
    // like a backend path is enough to leave the request alone.
    if (tin_is_backend_path($path)) {
        return true;
    }
    $live = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if ($live !== '' && $live !== tin_original_request_uri()
        && tin_is_backend_path(tin_request_path($live))) {
        return true;
    }
    // Previews and the customizer deliberately run on the origin host — they
    // need the admin auth cookie, which the frontend host doesn't carry.
    if (function_exists('is_customize_preview') && is_customize_preview()) {
        return true;
    }
    if (is_user_logged_in()) {
        foreach (['preview', 'preview_id', 'preview_nonce', 'customize_changeset_uuid', 'customize_theme'] as $key) {
            if (isset($_GET[$key])) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Send public page views on any non-frontend host to the frontend.
 *
 * Unconditional by design: the only things that stop it are the explicit
 * exclusions above, the on/off setting, and the request already being on the
 * frontend host. In particular it does *not* compare site_url() to home_url()
 * — that check made the whole feature silently dead whenever WP_HOME wasn't
 * pointed at the frontend, which is the common case.
 *
 * Hooked twice on purpose:
 *   - `init` (early) catches every frontend request, including ones a theme,
 *     a redirect plugin or a 404 handler would otherwise short-circuit before
 *     `template_redirect` ever runs.
 *   - `template_redirect` is the belt-and-braces second pass, in case
 *     something ran before our `init` callback and unset the request.
 */
function tin_maybe_redirect_to_frontend() {
    static $done = false;
    if ($done) {
        return;
    }

    if (!tin_frontend_redirect_enabled() || headers_sent()) {
        return;
    }

    $home = tin_frontend_target();
    $host = wp_parse_url($home, PHP_URL_HOST);
    if (!$host) {
        return; // Frontend URL not configured / unparseable — do nothing.
    }

    // Already on the frontend host — never redirect to ourselves.
    $current_host = isset($_SERVER['HTTP_HOST'])
        ? strtolower((string) wp_unslash($_SERVER['HTTP_HOST']))
        : '';
    if ($current_host === '' || $current_host === strtolower($host)) {
        return;
    }

    // Redirect the path the visitor actually asked for, not one a plugin
    // rewrote internally along the way.
    $path = tin_request_path();
    if (tin_skip_frontend_redirect($path)) {
        return;
    }

    /**
     * Filter the frontend redirect target. Return an empty value to cancel
     * the redirect for this request.
     */
    $target = apply_filters('tin_frontend_redirect_url', $home . $path, $path);
    if (!$target) {
        return;
    }

    $status = (int) apply_filters('tin_frontend_redirect_status', 301, $path);

    $done = true;
    wp_redirect($target, $status, 'Headless Helpers');
    exit;
}

add_action('init', 'tin_maybe_redirect_to_frontend', 1);
add_action('template_redirect', 'tin_maybe_redirect_to_frontend', 0);

/* =========================================================================
 * 6) Lean posts API — GET /wp-json/tin/v1/posts
 *
 * Same query surface as core's /wp/v2/posts (per_page, page, offset, search,
 * categories, tags, exclude, include, slug, sticky, orderby, order, plus the
 * X-WP-Total / X-WP-TotalPages headers), but shaped for a headless frontend:
 *
 *   - The featured image ships inline, with every generated size, so clients
 *     don't need `_embed`. Core's `_embed=1` drags along the full rendered
 *     content plus author and term objects for every post — 100 posts came
 *     back at ~4MB, big enough to blow past a CDN/ISR cache entry.
 *   - Author and terms are flattened into the post, also without `_embed`.
 *   - Titles and excerpts arrive as plain decoded text, not `{rendered: ...}`
 *     HTML that every consumer has to strip and entity-decode again.
 *   - Reading time is computed once here instead of per-render on the client.
 *   - `context=embed` (the default) omits `content` and the Yoast head, which
 *     is what list/archive/card views actually need. `context=view` returns
 *     the full article payload for single-post pages.
 *   - `_fields=a,b,c` trims the response further, like core's `_fields`.
 *
 * Read-only, published posts only, no auth required.
 * ========================================================================= */

const TIN_REST_NS = 'tin/v1';

add_action('rest_api_init', function () {
    register_rest_route(TIN_REST_NS, '/posts', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'tin_rest_get_posts',
        'permission_callback' => '__return_true',
    ]);

    // Single post by slug. Slugs may be percent-encoded Thai, so match
    // anything that isn't a path separator.
    register_rest_route(TIN_REST_NS, '/posts/(?P<slug>[^/]+)', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'tin_rest_get_post',
        'permission_callback' => '__return_true',
    ]);
});

/** Comma-separated (or array) list of IDs → clean int array. */
function tin_rest_id_list($value) {
    if ($value === null || $value === '') {
        return [];
    }
    $parts = is_array($value) ? $value : explode(',', (string) $value);
    $ids = array_map('absint', $parts);
    return array_values(array_filter(array_unique($ids)));
}

/**
 * HTML → plain text: drop block comments, script/style blocks and tags, then
 * decode entities and collapse whitespace.
 */
function tin_plain_text($html) {
    $text = (string) $html;
    $text = preg_replace('/<!--.*?-->/s', ' ', $text);
    $text = preg_replace('#<(script|style)[^>]*>.*?</\1>#is', ' ', $text);
    $text = wp_strip_all_tags($text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', $text));
}

/**
 * Reading time in minutes, derived from the *raw* post content so list
 * responses don't have to run the whole `the_content` filter chain. Uses the
 * same 220-words-per-minute rule the frontend used to apply client-side, so
 * the number people see doesn't shift.
 */
function tin_reading_minutes($raw_content) {
    $text = tin_plain_text($raw_content);
    if ($text === '') {
        return 1;
    }
    $words = count(array_filter(preg_split('/\s+/u', $text)));
    return max(1, (int) round($words / 220));
}

/**
 * Featured image with every size WordPress actually generated.
 *
 * Built from the attachment metadata rather than repeated
 * `wp_get_attachment_image_src()` calls, which silently fall back to the full
 * size for sizes that don't exist and would fill the response with
 * duplicates. URLs inherit the CDN rewrite via `wp_get_attachment_url()`.
 */
function tin_rest_featured_image($post_id) {
    $thumb_id = (int) get_post_thumbnail_id($post_id);
    if (!$thumb_id) {
        return null;
    }

    $full_url = wp_get_attachment_url($thumb_id);
    if (!$full_url) {
        return null;
    }

    $meta  = wp_get_attachment_metadata($thumb_id);
    $sizes = [];

    if (!empty($meta['sizes']) && is_array($meta['sizes'])) {
        $base = trailingslashit(dirname($full_url));
        foreach ($meta['sizes'] as $name => $size) {
            if (empty($size['file'])) {
                continue;
            }
            $sizes[$name] = [
                'url'    => $base . $size['file'],
                'width'  => isset($size['width']) ? (int) $size['width'] : null,
                'height' => isset($size['height']) ? (int) $size['height'] : null,
            ];
        }
    }

    $sizes['full'] = [
        'url'    => $full_url,
        'width'  => isset($meta['width']) ? (int) $meta['width'] : null,
        'height' => isset($meta['height']) ? (int) $meta['height'] : null,
    ];

    $attachment = get_post($thumb_id);

    return [
        'id'      => $thumb_id,
        'url'     => $full_url,
        'width'   => $sizes['full']['width'],
        'height'  => $sizes['full']['height'],
        'alt'     => (string) get_post_meta($thumb_id, '_wp_attachment_image_alt', true),
        'caption' => $attachment ? tin_plain_text($attachment->post_excerpt) : '',
        'sizes'   => $sizes,
    ];
}

/**
 * Every image the post references: the featured one first, then whatever the
 * content embeds. Image sitemaps want all of them, not just the thumbnail.
 *
 * Scanned off the raw content rather than the rendered output so list
 * responses don't have to run the `the_content` filter chain; CDN rewriting
 * is applied per URL instead.
 */
function tin_rest_post_images($post, $featured) {
    $urls = [];
    if (!empty($featured['url'])) {
        $urls[] = $featured['url'];
    }

    if (preg_match_all(
        '/<img[^>]+src\s*=\s*["\']([^"\']+)["\']/i',
        (string) $post->post_content,
        $matches
    )) {
        foreach ($matches[1] as $src) {
            $src = trim(html_entity_decode($src, ENT_QUOTES, 'UTF-8'));
            // Skip inline data URIs and anything not absolute — a sitemap
            // entry needs a resolvable URL.
            if ($src === '' || stripos($src, 'data:') === 0) {
                continue;
            }
            if (stripos($src, 'http://') !== 0 && stripos($src, 'https://') !== 0) {
                continue;
            }
            $urls[] = tin_cdn_rewrite($src);
        }
    }

    return array_values(array_unique($urls));
}

function tin_rest_terms($post_id, $taxonomy) {
    $terms = get_the_terms($post_id, $taxonomy);
    if (!$terms || is_wp_error($terms)) {
        return [];
    }
    return array_values(array_map(function ($t) {
        return [
            'id'   => (int) $t->term_id,
            'name' => tin_plain_text($t->name),
            'slug' => $t->slug,
        ];
    }, $terms));
}

/** Yoast's `yoast_head_json`, via Yoast's own surface API. Null when absent. */
function tin_rest_yoast($post_id) {
    if (!function_exists('YoastSEO')) {
        return null;
    }
    try {
        $meta = YoastSEO()->meta->for_post($post_id);
        if (!$meta) {
            return null;
        }
        $head = $meta->get_head();
        return is_object($head) && isset($head->json) ? $head->json : null;
    } catch (\Throwable $e) {
        return null;
    }
}

/**
 * One post → response array.
 *
 * @param WP_Post $post
 * @param bool    $full `context=view`: include rendered content + Yoast head.
 */
function tin_rest_post_item($post, $full = false) {
    $id = (int) $post->ID;

    $excerpt = trim((string) $post->post_excerpt);
    if ($excerpt === '') {
        // Derive from the raw content — `get_the_excerpt()` would render the
        // whole post just to trim it.
        $excerpt = wp_trim_words(tin_plain_text($post->post_content), 55, '…');
    } else {
        $excerpt = tin_plain_text($excerpt);
    }

    $author_id = (int) $post->post_author;
    $featured  = tin_rest_featured_image($id);

    $item = [
        'id'           => $id,
        'slug'         => $post->post_name,
        'link'         => get_permalink($post),
        'date'         => mysql_to_rfc3339($post->post_date),
        'date_gmt'     => mysql_to_rfc3339($post->post_date_gmt),
        'modified'     => mysql_to_rfc3339($post->post_modified),
        'modified_gmt' => mysql_to_rfc3339($post->post_modified_gmt),
        'title'        => tin_plain_text($post->post_title),
        'excerpt'      => $excerpt,
        'reading'      => tin_reading_minutes($post->post_content),
        'sticky'       => is_sticky($id),
        'featured'     => $featured,
        'images'       => tin_rest_post_images($post, $featured),
        'author'       => [
            'id'          => $author_id,
            'name'        => get_the_author_meta('display_name', $author_id),
            'slug'        => get_the_author_meta('user_nicename', $author_id),
            'avatar'      => get_avatar_url($author_id, ['size' => 96]),
            'description' => tin_plain_text(get_the_author_meta('description', $author_id)),
        ],
        'categories'   => tin_rest_terms($id, 'category'),
        'tags'         => tin_rest_terms($id, 'post_tag'),
    ];

    if ($full) {
        // `the_content` renders blocks/shortcodes and runs the CDN rewrite.
        $item['content'] = apply_filters('the_content', $post->post_content);
        $item['yoast']   = tin_rest_yoast($id);
    }

    return $item;
}

/** Restrict an item to the requested `_fields`, when given. */
function tin_rest_apply_fields($item, $fields) {
    if (!$fields) {
        return $item;
    }
    return array_intersect_key($item, array_flip($fields));
}

/** Parse the shared query/serialisation params off a request. */
function tin_rest_read_params($request) {
    $fields = $request->get_param('_fields');
    $fields = $fields
        ? array_values(array_filter(array_map('trim', explode(',', (string) $fields))))
        : [];

    return [
        'full'   => $request->get_param('context') === 'view',
        'fields' => $fields,
    ];
}

/**
 * GET /tin/v1/posts
 */
function tin_rest_get_posts($request) {
    $per_page = (int) ($request->get_param('per_page') ?: 12);
    $per_page = max(1, min(100, $per_page));
    $page     = max(1, (int) ($request->get_param('page') ?: 1));

    $args = [
        'post_type'           => 'post',
        'post_status'         => 'publish',
        'posts_per_page'      => $per_page,
        'paged'               => $page,
        // Sticky posts shouldn't jump the queue in an API response; callers
        // ask for them explicitly via `sticky=1`.
        'ignore_sticky_posts' => true,
    ];

    $offset = $request->get_param('offset');
    if ($offset !== null && $offset !== '') {
        $args['offset'] = absint($offset);
    }

    $search = trim((string) $request->get_param('search'));
    if ($search !== '') {
        $args['s'] = $search;
    }

    $slug = $request->get_param('slug');
    if ($slug) {
        $args['post_name__in'] = array_map('sanitize_title', explode(',', (string) $slug));
    }

    // Taxonomy filters go through tax_query with include_children, matching
    // how core's /wp/v2/posts treats `categories` — `category__in` would
    // silently drop posts filed only under a child category.
    $tax_query = [];
    foreach ([
        ['categories', 'category', 'IN'],
        ['categories_exclude', 'category', 'NOT IN'],
        ['tags', 'post_tag', 'IN'],
        ['tags_exclude', 'post_tag', 'NOT IN'],
    ] as list($param, $taxonomy, $operator)) {
        $ids = tin_rest_id_list($request->get_param($param));
        if ($ids) {
            $tax_query[] = [
                'taxonomy'         => $taxonomy,
                'field'            => 'term_id',
                'terms'            => $ids,
                'operator'         => $operator,
                'include_children' => true,
            ];
        }
    }
    if ($tax_query) {
        if (count($tax_query) > 1) {
            $tax_query['relation'] = 'AND';
        }
        $args['tax_query'] = $tax_query;
    }

    if ($include = tin_rest_id_list($request->get_param('include'))) {
        $args['post__in'] = $include;
    }
    if ($exclude = tin_rest_id_list($request->get_param('exclude'))) {
        $args['post__not_in'] = $exclude;
    }

    if (rest_sanitize_boolean($request->get_param('sticky'))) {
        $sticky = get_option('sticky_posts');
        // An empty post__in would return everything, which is the opposite of
        // what "only sticky posts" means.
        $args['post__in'] = $sticky ? $sticky : [0];
    }

    $orderby = (string) $request->get_param('orderby');
    $allowed = ['date', 'modified', 'title', 'id', 'ID', 'rand', 'relevance', 'menu_order', 'include'];
    if ($orderby && in_array($orderby, $allowed, true)) {
        $args['orderby'] = $orderby === 'id' ? 'ID' : $orderby;
    }
    $order = strtoupper((string) $request->get_param('order'));
    if ($order === 'ASC' || $order === 'DESC') {
        $args['order'] = $order;
    }

    $query  = new WP_Query($args);
    $params = tin_rest_read_params($request);

    $items = [];
    foreach ($query->posts as $post) {
        $items[] = tin_rest_apply_fields(
            tin_rest_post_item($post, $params['full']),
            $params['fields']
        );
    }

    $total = (int) $query->found_posts;
    $pages = $per_page > 0 ? (int) ceil($total / $per_page) : 0;

    $response = new WP_REST_Response($items, 200);
    $response->header('X-WP-Total', (string) $total);
    $response->header('X-WP-TotalPages', (string) $pages);
    return $response;
}

/**
 * GET /tin/v1/posts/<slug>
 *
 * Defaults to `context=view` — asking for one post by slug means you want the
 * article.
 */
function tin_rest_get_post($request) {
    $raw = (string) $request['slug'];
    // Non-ASCII slugs are stored percent-encoded in post_name. Depending on
    // the server the route segment may reach us encoded or decoded, so try
    // both forms.
    $candidates = array_values(array_unique(array_filter([
        sanitize_title(urldecode($raw)),
        sanitize_title($raw),
        $raw,
    ])));
    if (!$candidates) {
        return new WP_Error('tin_bad_slug', 'Missing slug', ['status' => 400]);
    }

    $query = new WP_Query([
        'post_type'      => 'post',
        'post_status'    => 'publish',
        'post_name__in'  => $candidates,
        'posts_per_page' => 1,
        'no_found_rows'  => true,
    ]);

    if (empty($query->posts)) {
        return new WP_Error('tin_not_found', 'Post not found', ['status' => 404]);
    }

    $fields = tin_rest_read_params($request)['fields'];
    $full   = $request->get_param('context') !== 'embed';

    return new WP_REST_Response(
        tin_rest_apply_fields(tin_rest_post_item($query->posts[0], $full), $fields),
        200
    );
}

/* =========================================================================
 * Settings page (Settings → Insight Headless)
 * ========================================================================= */

add_action('admin_menu', function () {
    add_options_page(
        'Headless',
        'Headless',
        'manage_options',
        'tin-headless',
        'tin_render_settings_page'
    );
});

function tin_render_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    if (isset($_POST['tin_save']) && check_admin_referer('tin_save_settings')) {
        update_option(
            TIN_OPTION_SECRET,
            sanitize_text_field(wp_unslash($_POST['tin_secret'] ?? ''))
        );
        update_option(
            TIN_OPTION_CDN_TARGET,
            esc_url_raw(trim(wp_unslash($_POST['tin_cdn_target'] ?? '')))
        );
        update_option(
            TIN_OPTION_FE_REDIRECT,
            empty($_POST['tin_frontend_redirect']) ? '0' : '1'
        );
        update_option(
            TIN_OPTION_FE_URL,
            esc_url_raw(trim(wp_unslash($_POST['tin_frontend_url'] ?? '')))
        );
        update_option(
            TIN_OPTION_FE_EXCLUDE,
            sanitize_textarea_field(wp_unslash($_POST['tin_frontend_exclude'] ?? ''))
        );
        echo '<div class="notice notice-success is-dismissible"><p>Saved.</p></div>';
    }
    $secret       = get_option(TIN_OPTION_SECRET, '');
    $cdn_target   = get_option(TIN_OPTION_CDN_TARGET, '');
    $fe_url_opt   = get_option(TIN_OPTION_FE_URL, '');
    $fe_exclude   = get_option(TIN_OPTION_FE_EXCLUDE, '');
    $overridden   = defined('TIN_REVALIDATE_SECRET') && TIN_REVALIDATE_SECRET;
    $fe_forced    = defined('TIN_FRONTEND_URL') && TIN_FRONTEND_URL;
    $origin       = tin_origin_url();
    $home         = tin_frontend_target();
    $wp_home      = untrailingslashit(tin_frontend_url());
    $endpoint     = tin_revalidate_endpoint();
    $active_target = tin_cdn_target();
    $fe_redirect   = tin_frontend_redirect_enabled();
    $same_host     = strtolower((string) wp_parse_url($home, PHP_URL_HOST))
                     === strtolower((string) wp_parse_url($origin, PHP_URL_HOST));
    ?>
    <div class="wrap">
        <h1>Headless Helpers</h1>
        <p class="description">
            Frontend revalidation, CDN rewrites, and admin-link fixes for headless WordPress.
        </p>
        <?php if ($fe_redirect && $same_host): ?>
            <div class="notice notice-warning">
                <p>
                    <strong>Frontend redirect is doing nothing.</strong>
                    The frontend URL (<code><?php echo esc_html($home); ?></code>) resolves to the
                    same host WordPress is served from, so there is nowhere to redirect to.
                    Set an explicit <strong>Frontend URL</strong> below.
                </p>
            </div>
        <?php endif; ?>
        <form method="post">
            <?php wp_nonce_field('tin_save_settings'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="tin_frontend_url">Frontend URL</label></th>
                    <td>
                        <input type="url"
                               id="tin_frontend_url"
                               name="tin_frontend_url"
                               class="regular-text"
                               placeholder="<?php echo esc_attr($wp_home); ?>"
                               value="<?php echo esc_attr($fe_url_opt); ?>"
                               <?php disabled($fe_forced); ?> />
                        <p class="description">
                            Public site the redirect below points at, e.g.
                            <code>https://www.example.com</code>. Leave blank to fall back to
                            <strong>Settings → General → Site Address</strong>
                            (<code><?php echo esc_html($wp_home); ?></code>) — but set it
                            explicitly if that value isn't your frontend, otherwise the
                            redirect has nowhere to go and silently does nothing.
                            <?php if ($fe_forced): ?>
                                <br><strong>Currently overridden by the <code>TIN_FRONTEND_URL</code> constant in wp-config.php.</strong>
                            <?php endif; ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tin_secret">Revalidate secret</label></th>
                    <td>
                        <input type="password"
                               id="tin_secret"
                               name="tin_secret"
                               class="regular-text"
                               autocomplete="off"
                               value="<?php echo esc_attr($secret); ?>"
                               <?php disabled($overridden); ?> />
                        <p class="description">
                            Shared secret for <code>POST <?php echo esc_html($endpoint); ?></code>.
                            Must match <code>REVALIDATE_SECRET</code> on the frontend.
                            <?php if ($overridden): ?>
                                <br><strong>Currently overridden by <code>TIN_REVALIDATE_SECRET</code> constant in wp-config.php.</strong>
                            <?php endif; ?>
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tin_cdn_target">CDN host <em>(optional)</em></label></th>
                    <td>
                        <input type="url"
                               id="tin_cdn_target"
                               name="tin_cdn_target"
                               class="regular-text"
                               placeholder="https://files.example.com"
                               value="<?php echo esc_attr($cdn_target); ?>" />
                        <p class="description">
                            If set, all <code>/wp-content/uploads/*</code> URLs coming out of
                            WordPress (REST API, srcset, post content) are rewritten from
                            <code><?php echo esc_html($origin); ?></code> to this host.
                            Leave blank to disable.
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Redirect origin → frontend</th>
                    <td>
                        <label>
                            <input type="checkbox"
                                   name="tin_frontend_redirect"
                                   value="1"
                                   <?php checked($fe_redirect); ?> />
                            301-redirect public page views on any other host to
                            <code><?php echo esc_html($home); ?></code>
                        </label>
                        <p class="description">
                            Only page views are redirected. Everything under
                            <code>/wp-*</code> stays here — that's all of
                            <code>/wp-admin</code>, <code>/wp-json</code>,
                            <code>/wp-login.php</code>, <code>/wp-content</code>,
                            <code>/wp-includes</code>, <code>wp-cron</code>, and any
                            renamed admin entry point such as
                            <code>/wp-backoffice</code> — along with
                            <code>xmlrpc.php</code>, <code>robots.txt</code>,
                            <code>/.well-known</code>, non-GET requests, post previews
                            and the customizer.
                        </p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="tin_frontend_exclude">Never redirect these paths</label></th>
                    <td>
                        <textarea id="tin_frontend_exclude"
                                  name="tin_frontend_exclude"
                                  class="large-text code"
                                  rows="4"
                                  placeholder="/my-custom-login&#10;/some-origin-only-page"><?php echo esc_textarea($fe_exclude); ?></textarea>
                        <p class="description">
                            One path prefix per line, on top of the built-in list. Only
                            needed for origin-only paths that <em>don't</em> start with
                            <code>/wp-</code> — a login slug renamed to something like
                            <code>/secret-door</code>, for instance.
                        </p>
                        <p class="description" style="margin-top:.6em;">
                            <strong>Currently kept on this host:</strong>
                            <?php foreach (tin_backend_path_prefixes() as $p): ?>
                                <code><?php echo esc_html($p); ?></code>&nbsp;
                            <?php endforeach; ?>
                        </p>
                    </td>
                </tr>
            </table>

            <h2 class="title" style="margin-top:2em;">Current state</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">Admin / origin URL</th>
                    <td><code><?php echo esc_html($origin); ?></code> <span class="description">(from <code>site_url()</code>)</span></td>
                </tr>
                <tr>
                    <th scope="row">Redirect target</th>
                    <td>
                        <code><?php echo esc_html($home); ?></code>
                        <span class="description">
                            <?php if ($fe_forced): ?>
                                (from the <code>TIN_FRONTEND_URL</code> constant)
                            <?php elseif ($fe_url_opt): ?>
                                (from the Frontend URL setting above)
                            <?php else: ?>
                                (falling back to <code>home_url()</code>)
                            <?php endif; ?>
                        </span>
                    </td>
                </tr>
                <tr>
                    <th scope="row">WP_HOME</th>
                    <td><code><?php echo esc_html($wp_home); ?></code> <span class="description">(from <code>home_url()</code>)</span></td>
                </tr>
                <tr>
                    <th scope="row">Revalidate endpoint</th>
                    <td><code><?php echo esc_html($endpoint); ?></code></td>
                </tr>
                <tr>
                    <th scope="row">CDN rewrite</th>
                    <td>
                        <?php if ($active_target): ?>
                            <code><?php echo esc_html($origin); ?>/wp-content/uploads/</code>
                            &nbsp;→&nbsp;
                            <code><?php echo esc_html($active_target); ?>/wp-content/uploads/</code>
                            <p class="description">
                                Applied only for public requests. Admin (editor, media library)
                                still sees origin URLs so it can fetch/validate them reliably.
                            </p>
                        <?php else: ?>
                            <em>Disabled (no CDN host configured).</em>
                        <?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Admin permalink rewrite</th>
                    <td>
                        <?php if ($origin === $wp_home): ?>
                            <em>Disabled — <code>site_url()</code> and <code>home_url()</code> are the same.</em>
                        <?php else: ?>
                            Non-admin URLs that start with <code><?php echo esc_html($origin); ?></code>
                            are rewritten to <code><?php echo esc_html($wp_home); ?></code>.
                        <?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Frontend redirect</th>
                    <td>
                        <?php if (!$fe_redirect): ?>
                            <em>Disabled — visitors can browse this host directly.</em>
                        <?php elseif ($same_host): ?>
                            <em>Inactive — the redirect target is this same host.</em>
                        <?php else: ?>
                            <code>&lt;any other host&gt;/&lt;path&gt;</code>
                            &nbsp;→&nbsp;
                            <code><?php echo esc_html($home); ?>/&lt;path&gt;</code>
                            <span class="description">(301, query string preserved)</span>
                        <?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Admin REST URL</th>
                    <td>
                        <?php if ($origin === $wp_home): ?>
                            <em>No rewrite needed — same host.</em>
                        <?php else: ?>
                            In wp-admin, <code>rest_url()</code> resolves to
                            <code><?php echo esc_html($origin); ?>/wp-json/</code>
                            instead of <code><?php echo esc_html($wp_home); ?>/wp-json/</code>
                            so the block editor can reach WordPress directly.
                        <?php endif; ?>
                    </td>
                </tr>
            </table>
            <?php submit_button('Save', 'primary', 'tin_save'); ?>
        </form>
    </div>
    <?php
}
