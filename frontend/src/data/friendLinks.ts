export interface FriendLink {
  name: string;
  url: string;
  description: string;
  avatarUrl?: string;
  rssUrl?: string;
}

// Add approved friend sites here, for example:
// { name: '朋友的博客', url: 'https://example.com', description: '学习与生活记录',
//   avatarUrl: 'https://example.com/avatar.png', rssUrl: 'https://example.com/feed.xml' }
// Only absolute HTTP(S) URLs are displayed. Do not put credentials in URLs.
export const friendLinks: FriendLink[] = [
  {
    name: 'SLIME',
    url: 'https://www.onlyslime.online/',
    description: 'Personal archive & navigation',
    avatarUrl: 'https://www.onlyslime.online/logo.png',
    rssUrl: 'https://onlyslime.online/feed.xml',
  },
  {
    name: '周浩洋 | Haoyang Zhou',
    url: 'https://zhouhaoyang.me/',
    description: '语音交互、语音智能体与深度学习的数字花园。',
    avatarUrl: 'https://zhouhaoyang.me/favicon.svg',
    rssUrl: 'https://zhouhaoyang.me/rss.xml',
  },
];

export function isSafeFriendUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
