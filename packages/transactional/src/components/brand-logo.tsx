import { Text } from "react-email";

import { APP_NAME } from "../brand";

/** The nav wordmark: hollow square mark plus the name in the display weight. */
const BrandLogo = () => {
  return (
    <Text className="m-0 inline-block align-middle font-sans text-lg leading-6.5 font-semibold tracking-tight text-primary-foreground no-underline">
      <span className="-mt-0.5 mr-3 inline-block h-3 w-3 border-2 border-solid border-primary-foreground align-middle" />
      {APP_NAME}
    </Text>
  );
};

export { BrandLogo };
