import { Heading, Text } from "react-email";

import { Button } from "../components/button";
import { Card } from "../components/card";
import { Divider } from "../components/divider";

import { BaseLayout } from "./base-layout";

type TeamNotificationProps = { heading: string; message: string; teamUrl: string };

export const TeamNotification = ({ heading, message, teamUrl }: TeamNotificationProps) => (
  <BaseLayout preview={message}>
    <Heading className="mt-0 mb-4 text-2xl font-semibold text-foreground">{heading}</Heading>
    <Card>
      <Text className="text-base text-muted-foreground">{message}</Text>
    </Card>
    <Divider spacing="sm" />
    <Button fullWidth href={teamUrl} variant="primary">
      Open workspace
    </Button>
  </BaseLayout>
);
