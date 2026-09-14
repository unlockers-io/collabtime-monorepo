/* oxlint-disable typescript/consistent-type-definitions, typescript/consistent-indexed-object-style -- React module augmentation requires declaration merging with an index signature. */
import "react";

declare module "react" {
  interface CSSProperties {
    [property: `--${string}`]: string | number | undefined;
  }
}
