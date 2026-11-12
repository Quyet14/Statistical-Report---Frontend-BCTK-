# Statistical-Report---Frontend-BCTK-

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Vietnamese and English interface

The authenticated workspace has a Vietnamese/English selector in its header.
Selecting English translates fixed interface text throughout the rendered
workspace, including feature pages and dynamically opened controls. The frontend
loads a generated catalog in pages from the authenticated backend endpoint; the
backend translates and caches only fixed source-code UI labels. To add or update
catalog entries, run `npm run i18n:catalog` from this repository with the backend
repository available beside it.

Task titles, checklist items, and SOP titles, descriptions, and content can be
entered in Vietnamese and English side by side. These translations are
user-provided, are shown when English is selected, and require the backend
`BILINGUAL_CONTENT_ENABLED` flag and the reviewed
`scripts/bilingual-content-schema.cjs` migration. Task names, checklist text,
SOP content, and other user-entered content are not included in the UI
translation request. English UI translation requires the backend
`UI_TRANSLATION_ENABLED` flag, the reviewed i18n schema, and approved provider
configuration; without these the feature remains unavailable.

The sign-in and authenticated workspace share a coordinated navy, teal, and
light-surface visual theme. In the workspace, the background control can switch
between animated, still, and light modes; content panels retain solid, high-
contrast surfaces so sections and operational states remain easy to distinguish.
