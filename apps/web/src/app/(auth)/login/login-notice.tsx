import { FormNotice } from "../auth-shell";

type LoginNoticeProps = {
  searchParams: Promise<{ message?: string | Array<string> }>;
};

// Exact match only: the query string is user-controlled, so its text is never rendered.
const PASSWORD_RESET_SUCCESS = "password-reset-success";

const PASSWORD_RESET_NOTICE_URL = `/login?message=${PASSWORD_RESET_SUCCESS}`;

const LoginNotice = async ({ searchParams }: LoginNoticeProps) => {
  const { message } = await searchParams;

  if (message !== PASSWORD_RESET_SUCCESS) {
    return null;
  }

  return (
    <FormNotice tone="success">
      Your password has been reset. Sign in with your new password.
    </FormNotice>
  );
};

export { LoginNotice, PASSWORD_RESET_NOTICE_URL };
