import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Chỉ bảo vệ các đường dẫn bắt đầu bằng /api/chat
  if (request.nextUrl.pathname.startsWith('/api/chat')) {
    const authCookie = request.cookies.get('auth_token')?.value;
    const authHeader = request.headers.get('Authorization')?.replace('Bearer ', '');
    
    const token = authCookie || authHeader;

    // So sánh token với PASSPHRASE_HASH lưu trong môi trường
    const validHash = process.env.PASSPHRASE_HASH;
    
    if (!validHash) {
      console.warn("Chưa cấu hình PASSPHRASE_HASH trên Server!");
      return NextResponse.next(); // Bypass tạm thời nếu chưa cài biến môi trường
    }

    if (!token || token !== validHash) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
