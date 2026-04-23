<?php
/**
 * Plugin Name: Headless Helpers
 * Description: Three helpers for running WordPress headless behind a separate frontend — (1) optionally rewrites /wp-content/uploads/* URLs to a dedicated CDN host, (2) fires on-demand ISR revalidation on the frontend when a post is saved + exposes a manual "Clear cache" button in the editor, (3) makes admin "View Post" links point to the frontend. Site-agnostic — drop it into any WP install and configure via Settings → Headless.
 * Version: 1.3.0
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

const TIN_OPTION_SECRET     = 'tin_revalidate_secret';
const TIN_OPTION_CDN_TARGET = 'tin_cdn_target';

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
    $page = array_values(array_filter(['/', $slug ? '/' . $slug : null]));

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
        echo '<div class="notice notice-success is-dismissible"><p>Saved.</p></div>';
    }
    $secret       = get_option(TIN_OPTION_SECRET, '');
    $cdn_target   = get_option(TIN_OPTION_CDN_TARGET, '');
    $overridden   = defined('TIN_REVALIDATE_SECRET') && TIN_REVALIDATE_SECRET;
    $origin       = tin_origin_url();
    $home         = untrailingslashit(tin_frontend_url());
    $endpoint     = tin_revalidate_endpoint();
    $active_target = tin_cdn_target();
    ?>
    <div class="wrap">
        <h1>Headless Helpers</h1>
        <p class="description">
            Frontend revalidation, CDN rewrites, and admin-link fixes for headless WordPress.
            Frontend URL is taken from <strong>Settings → General → Site Address (URL)</strong>
            so the plugin is portable across installs.
        </p>
        <form method="post">
            <?php wp_nonce_field('tin_save_settings'); ?>
            <table class="form-table" role="presentation">
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
            </table>

            <h2 class="title" style="margin-top:2em;">Current state</h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">Admin / origin URL</th>
                    <td><code><?php echo esc_html($origin); ?></code> <span class="description">(from <code>site_url()</code>)</span></td>
                </tr>
                <tr>
                    <th scope="row">Frontend URL</th>
                    <td><code><?php echo esc_html($home); ?></code> <span class="description">(from <code>home_url()</code>)</span></td>
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
                        <?php if ($origin === $home): ?>
                            <em>Disabled — admin and frontend share the same host.</em>
                        <?php else: ?>
                            Non-admin URLs that start with <code><?php echo esc_html($origin); ?></code>
                            are rewritten to <code><?php echo esc_html($home); ?></code>.
                        <?php endif; ?>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Admin REST URL</th>
                    <td>
                        <?php if ($origin === $home): ?>
                            <em>No rewrite needed — same host.</em>
                        <?php else: ?>
                            In wp-admin, <code>rest_url()</code> resolves to
                            <code><?php echo esc_html($origin); ?>/wp-json/</code>
                            instead of <code><?php echo esc_html($home); ?>/wp-json/</code>
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
