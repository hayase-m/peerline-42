import { NextResponse } from 'next/server';
import { FortyTwoApiError } from '@/lib/forty-two-api';
import { getPeerDetail } from '@/lib/cohort';
import { readSession } from '@/lib/session';

interface RouteContext {
  params: Promise<{ login: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const session = await readSession();

  if (!session) {
    return NextResponse.json({ message: 'ログインが必要です。' }, { status: 401 });
  }

  const { login } = await context.params;

  if (!/^[a-z0-9_-]{1,32}$/i.test(login)) {
    return NextResponse.json(
      { message: 'loginの形式が正しくありません。' },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const cursusValue = url.searchParams.get('cursusId');
  const parsedCursus = cursusValue === null ? null : Number(cursusValue);
  const cursusId =
    parsedCursus !== null && Number.isInteger(parsedCursus)
      ? parsedCursus
      : null;

  try {
    const detail = await getPeerDetail(
      session.accessToken,
      login,
      cursusId,
    );
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof FortyTwoApiError) {
      return NextResponse.json(
        { message: error.status === 404 ? 'ユーザーが見つかりません。' : '42 APIから情報を取得できませんでした。' },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { message: '情報を取得できませんでした。' },
      { status: 500 },
    );
  }
}
