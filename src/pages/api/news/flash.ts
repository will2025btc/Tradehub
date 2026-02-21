import type { NextApiRequest, NextApiResponse } from 'next';

const FOLLOWIN_API_KEY = process.env.FOLLOWIN_API_KEY || 'a098zaETYUoXBWDopyGAMYGdw4J6vrtp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '方法不允许' });
  }

  try {
    const { last_cursor, count = '20', lang = 'zh-Hans' } = req.query;

    let url = `https://api.followin.io/open/feed/news?apikey=${FOLLOWIN_API_KEY}&lang=${lang}&count=${count}`;
    if (last_cursor) {
      url += `&last_cursor=${last_cursor}`;
    }

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    const data = await response.json();

    if (data.code === 2000) {
      return res.status(200).json(data.data);
    } else {
      return res.status(500).json({ message: data.msg || 'API请求失败' });
    }
  } catch (error) {
    console.error('快讯API错误:', error);
    return res.status(500).json({ message: '服务器错误' });
  }
}
