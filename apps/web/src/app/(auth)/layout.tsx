export const dynamic = "force-dynamic";

type AuthLayoutProps = {
  children: React.ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="p-6 md:p-10 flex min-h-svh flex-col items-center justify-center bg-muted">
      <div className="max-w-sm gap-6 flex w-full flex-col">{children}</div>
    </div>
  );
};

export default AuthLayout;
