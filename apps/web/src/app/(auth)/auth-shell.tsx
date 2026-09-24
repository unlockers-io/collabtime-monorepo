import { cn } from "@repo/ui/lib/utils";
import { CircleAlert, CircleCheck, Info, type LucideIcon } from "lucide-react";

type AuthPageProps = {
  children: React.ReactNode;
  description: React.ReactNode;
  notice?: React.ReactNode;
  title: string;
};

const AuthPage = ({ children, description, notice, title }: AuthPageProps) => (
  <div className="flex flex-col gap-10">
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl leading-tight font-semibold tracking-display text-balance">
          {title}
        </h1>
        <p className="text-base text-pretty text-muted-foreground">{description}</p>
      </header>
      {notice}
    </div>
    {children}
  </div>
);

const AuthFooter = ({ children }: { children: React.ReactNode }) => (
  <p className="border-t border-border pt-6 text-sm text-muted-foreground">{children}</p>
);

type FormNoticeProps = {
  children: React.ReactNode;
  tone: "error" | "neutral" | "success";
};

const NOTICE_ICONS = {
  error: CircleAlert,
  neutral: Info,
  success: CircleCheck,
} satisfies Record<FormNoticeProps["tone"], LucideIcon>;

const FormNotice = ({ children, tone }: FormNoticeProps) => {
  const Icon = NOTICE_ICONS[tone];
  const body = (
    <>
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "error" && "text-destructive",
          tone === "success" && "text-success",
          tone === "neutral" && "text-muted-foreground",
        )}
      />
      <span>{children}</span>
    </>
  );

  if (tone === "error") {
    return (
      <div className="flex gap-2 text-sm text-pretty text-destructive" role="alert">
        {body}
      </div>
    );
  }
  return (
    <output aria-live="polite" className="flex gap-2 text-sm text-pretty text-foreground">
      {body}
    </output>
  );
};

type AuthConfirmationProps = {
  children: React.ReactNode;
  title: string;
};

const AuthConfirmation = ({ children, title }: AuthConfirmationProps) => (
  <output aria-live="polite" className="flex gap-3">
    <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-success" />
    <span className="flex flex-col gap-1.5">
      <span className="font-medium text-foreground">{title}</span>
      <span className="text-sm text-pretty text-muted-foreground">{children}</span>
    </span>
  </output>
);

const AUTH_LINK_CLASS = "font-medium text-foreground underline underline-offset-4";

export { AUTH_LINK_CLASS, AuthConfirmation, AuthFooter, AuthPage, FormNotice };
