import { prisma } from '../db.js';
import { nanoid } from 'nanoid';

const t = (text: string, styles: Record<string, unknown> = {}) => [
  { type: 'text', text, styles },
];

const block = (type: string, text: string, props: Record<string, unknown> = {}) => ({
  id: nanoid(),
  type,
  props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', ...props },
  content: text ? t(text) : [],
  children: [],
});

/** A friendly first page so a fresh account isn't an empty canvas. */
export function welcomeDocument(): unknown[] {
  return [
    { ...block('heading', 'Welcome to Weft', { level: 1 }) },
    block(
      'paragraph',
      'Weft is your local-first workspace — a woven web of connected notes. Everything here lives on your machine.',
    ),
    block('paragraph', ''),
    { ...block('heading', 'Try these', { level: 2 }) },
    {
      id: nanoid(),
      type: 'checkListItem',
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', checked: false },
      content: t('Type "/" anywhere to open the slash menu'),
      children: [],
    },
    {
      id: nanoid(),
      type: 'checkListItem',
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', checked: false },
      content: t('Press ⌘K to jump between pages'),
      children: [],
    },
    {
      id: nanoid(),
      type: 'checkListItem',
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left', checked: false },
      content: t('Drag pages in the sidebar to nest them'),
      children: [],
    },
    block('paragraph', ''),
    block('paragraph', '🧵 Tip: add a cover and an icon to give this page some character.'),
  ];
}

/** Create a workspace with the owner membership and a welcome page. */
export async function createDefaultWorkspace(userId: string, name: string) {
  const workspace = await prisma.workspace.create({
    data: {
      name,
      ownerId: userId,
      memberships: { create: { userId, role: 'owner' } },
    },
  });

  const page = await prisma.page.create({
    data: {
      workspaceId: workspace.id,
      title: 'Welcome to Weft',
      icon: '🧵',
      content: welcomeDocument() as never,
      position: 1000,
      createdById: userId,
      lastEditedById: userId,
    },
  });

  return { workspace, page };
}
