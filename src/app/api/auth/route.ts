import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { passHash } = await req.json();

    const validHash = process.env.PASSPHRASE_HASH;
    
    if (!validHash) {
      return NextResponse.json({ error: 'Server chưa cài đặt biến PASSPHRASE_HASH' }, { status: 500 });
    }

    if (passHash === validHash) {
      // Set cookie
      const response = NextResponse.json({ success: true });
      response.cookies.set({
        name: 'auth_token',
        value: passHash,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
      return response;
    } else {
      return NextResponse.json({ error: 'Mật khẩu sai!' }, { status: 401 });
    }
  } catch (err) {
    return NextResponse.json({ error: 'Lỗi xác thực' }, { status: 500 });
  }
}
