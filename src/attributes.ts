/** Standard profile keys for setUserAttributes after identify. No automatic collection. */
export const NudgeOnAttributes = Object.freeze({
  firstName: "first_name",
  lastName: "last_name",
  email: "email",
  phone: "phone",
  dateOfBirth: "dob",
  gender: "gender",
  homeCity: "home_city",
  country: "country",
  language: "language",
  timezone: "timezone",
  createdAt: "created_at",
} as const);

export type NudgeOnStandardAttribute = (typeof NudgeOnAttributes)[keyof typeof NudgeOnAttributes];
