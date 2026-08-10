import { NextResponse } from 'next/server';
import { getCohortTimeline } from '@/lib/cohort';
import { FortyTwoApiError } from '@/lib/forty-two-api';
import { normalizePoolMonth, normalizePoolYear } from '@/lib/pool';
import { readSession } from '@/lib/session';

export async function GET(request: Request) {
  const session = await readSession();

  if (!session) {
    return NextResponse.json(
      { message: 'ログインが必要です。' },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const year = normalizePoolYear(url.searchParams.get('year'));
  const month = normalizePoolMonth(url.searchParams.get('month'));

  try {
    const timeline = await getCohortTimeline(session.accessToken, {
      year: year ?? undefined,
      month: month ?? undefined,
    });

    return NextResponse.json(timeline);
  } catch (error) {
    if (error instanceof FortyTwoApiError) {
      return NextResponse.json(
        { message: '42 APIから提出履歴を取得できませんでした。' },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { message: '提出履歴を取得できませんでした。' },
      { status: 500 },
    );
  }
}
