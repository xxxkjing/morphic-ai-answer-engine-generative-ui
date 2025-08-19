import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // 获取协议和主机信息，用于构建 baseUrl
  const protocol =
    request.headers.get('x-forwarded-proto') || request.nextUrl.protocol
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const baseUrl = `${protocol}${protocol.endsWith(':') ? '//' : '://'}${host}`

  // 获取 Supabase 配置
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  let response: NextResponse

  // 如果 Supabase 配置存在，验证会话
  if (supabaseUrl && supabaseAnonKey) {
    // 获取当前用户会话
    const { data: { user } } = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    }).then(res => res.json())

    // 如果用户未登录且访问根目录，重定向到登录页面
    if (!user && request.nextUrl.pathname === '/') {
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // 否则更新会话
    response = await updateSession(request)
  } else {
    // 如果没有配置 Supabase，直接继续请求
    response = NextResponse.next({
      request
    })
  }

  // 设置请求相关信息到响应头
  response.headers.set('x-url', request.url)
  response.headers.set('x-host', host)
  response.headers.set('x-protocol', protocol)
  response.headers.set('x-base-url', baseUrl)

  return response
}

export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，排除以下路径：
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (图标文件)
     * 可以根据需要修改这个模式，包含更多路径。
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
}
