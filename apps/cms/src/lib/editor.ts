import {
  BlocksFeature,
  FixedToolbarFeature,
  lexicalEditor,
  UploadFeature,
} from '@payloadcms/richtext-lexical'
import { contentBlocks } from '../blocks'

/** Article body editor: the default toolbar plus images with captions and blocks. */
export const articleEditor = lexicalEditor({
  features: ({ defaultFeatures }) => [
    ...defaultFeatures.filter((f) => f.key !== 'upload'),
    FixedToolbarFeature(),
    UploadFeature({
      collections: {
        media: {
          fields: [{ name: 'caption', label: 'คำบรรยายภาพ', type: 'text' }],
        },
      },
    }),
    BlocksFeature({ blocks: contentBlocks }),
  ],
})
