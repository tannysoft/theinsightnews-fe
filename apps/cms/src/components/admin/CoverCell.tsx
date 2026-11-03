import type { DefaultServerCellComponentProps } from 'payload'

type MediaDoc = {
  url?: string | null
  alt?: string | null
  sizes?: { thumbnail?: { url: string } } | null
}

const editURL = ({ payload, collectionSlug, rowData }: DefaultServerCellComponentProps) =>
  `${payload.config.routes.admin}/collections/${collectionSlug}/${rowData?.id}`

/** Cover image thumbnail in the posts list (the 320 px copy when it exists); opens the story. */
export async function CoverCell(props: DefaultServerCellComponentProps) {
  const { cellData, payload } = props
  const id = cellData && typeof cellData === 'object' ? (cellData as { id?: number }).id : cellData
  const media = id
    ? ((await payload
        .findByID({ collection: 'media', id: id as number, depth: 0, overrideAccess: true, disableErrors: true })
        .catch((): null => null)) as MediaDoc | null)
    : null
  const src = media?.sizes?.thumbnail?.url ?? media?.url
  return (
    <a href={editURL(props)} className="list-cover-link" style={{ display: 'block', width: 96 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={media?.alt ?? ''} loading="lazy" style={{ ...box, objectFit: 'cover' }} />
      ) : (
        <span style={box} />
      )}
    </a>
  )
}

/** Story title linking to the edit view, whichever column it's in. */
export function TitleCell(props: DefaultServerCellComponentProps) {
  return (
    <a href={editURL(props)} className="list-title-link">
      {String(props.cellData ?? '') || '(ไม่มีหัวข้อ)'}
    </a>
  )
}

const box = {
  display: 'block',
  width: 96,
  height: 54,
  borderRadius: 4,
  background: 'var(--theme-elevation-100)',
} as const
