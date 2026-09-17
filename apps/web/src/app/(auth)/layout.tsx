import { Logo } from "@/components/nav/logo";

type AuthLayoutProps = {
  children: React.ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <main
    className="flex flex-1 flex-col items-center justify-center bg-background p-6 md:p-10"
    id="main"
  >
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex justify-center">
        <Logo />
      </div>
      {children}
    </div>
  </main>
);

export default AuthLayout;
