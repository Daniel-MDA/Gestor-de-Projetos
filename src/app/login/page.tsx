import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center p-6 tf-grid-bg">
      <div className="w-full max-w-md">
        <LoginForm next={next} />
      </div>
    </main>
  );
}
