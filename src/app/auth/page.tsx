import { AuthFlow } from '@/components/AuthFlow';

type AuthPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AuthPage({ searchParams }: AuthPageProps) {
  const params = await searchParams;
  const roomId = typeof params.room === 'string' ? params.room : null;

  return <AuthFlow initialRoomId={roomId} />;
}
