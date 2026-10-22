import { Heading, Link, Text } from "react-email";

import { APP_NAME } from "../brand";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Divider } from "../components/divider";
import { teamLabel } from "../team-label";

import { BaseLayout } from "./base-layout";

type InvitationEmailProps = {
  expiresAt?: string;
  inviterName: string;
  recipientEmail: string;
  teamName: string;
  teamUrl: string;
};

const InvitationEmail = ({
  expiresAt,
  inviterName,
  recipientEmail,
  teamName,
  teamUrl,
}: InvitationEmailProps) => {
  return (
    <BaseLayout
      preview={`${inviterName} invited you to join ${teamLabel(teamName)} on ${APP_NAME}`}
    >
      <Heading className="mt-0 mb-4 text-2xl font-semibold tracking-tight text-balance break-words text-foreground">
        You&apos;ve been invited
      </Heading>

      <Text className="m-0 mb-6 text-base text-pretty break-words text-muted-foreground">
        <strong className="text-foreground">{inviterName}</strong> invited you to join{" "}
        <strong className="text-foreground">{teamLabel(teamName)}</strong> on {APP_NAME}.
      </Text>

      <div className="mb-6">
        <Button fullWidth href={teamUrl} variant="primary">
          Open workspace
        </Button>
      </div>

      <Card accent title="What's next">
        <Text className="m-0 mb-2 text-base text-muted-foreground">
          Sign in or create an account with this email address ({recipientEmail}) to accept the
          invitation.
        </Text>
      </Card>

      {expiresAt !== undefined && (
        <Text>
          This invitation expires on{" "}
          {new Date(expiresAt).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" })}.
        </Text>
      )}

      <Divider spacing="sm" />

      <Text className="m-0 text-xs text-muted-foreground">
        If the button above doesn&apos;t work, copy and paste this link into your browser:
        <br />
        <Link className="break-all text-foreground underline" href={teamUrl}>
          {teamUrl}
        </Link>
      </Text>
    </BaseLayout>
  );
};

export { InvitationEmail };

export default InvitationEmail;
