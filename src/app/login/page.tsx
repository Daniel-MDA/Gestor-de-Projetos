import LoginForm from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[#f8f6f1]">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  );
}