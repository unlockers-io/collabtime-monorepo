import { z } from "zod";

// Accepts bare email or RFC 5322 "Display Name <email>"; z.email() alone rejects the bracketed form.
const senderAddressSchema = z.string().refine(
  (val) => {
    const email = /^.+<(?<email>[^<>\s]+)>$/v.exec(val)?.groups?.email ?? val;

    return z.email().safeParse(email).success;
  },
  { message: "Must be a valid email or 'Display Name <email>' format" },
);

export { senderAddressSchema };
