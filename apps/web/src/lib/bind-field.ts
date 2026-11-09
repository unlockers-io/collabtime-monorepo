type BindableField<TValue> = {
  handleBlur: () => void;
  handleChange: (value: TValue) => void;
  state: {
    meta: { errors: Array<unknown>; isValid: boolean };
    value: TValue;
  };
};

const bindField = <TValue>(field: BindableField<TValue>) => ({
  errors: field.state.meta.errors,
  isInvalid: !field.state.meta.isValid,
  onBlur: field.handleBlur,
  onChange: field.handleChange,
  value: field.state.value,
});

export { bindField };
