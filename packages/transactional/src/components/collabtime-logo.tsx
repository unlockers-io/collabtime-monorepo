import { Text } from "react-email";

type CollabTimeLogoProps = {
  height?: number;
  width?: number;
};

// Inline text-based wordmark — collabtime has no hosted logo asset, and
// many email clients block remote images by default. A styled wordmark
// renders identically with no external dependency.
const CollabTimeLogo = ({ height = 26 }: CollabTimeLogoProps) => {
  return (
    <Text
      className="m-0 inline-block align-middle font-mono text-[18px] font-bold tracking-tight text-primary-foreground no-underline"
      style={{ lineHeight: `${height}px` }}
    >
      Collab Time
    </Text>
  );
};

export { CollabTimeLogo };
