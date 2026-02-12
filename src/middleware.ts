// only logged-in users can view /app
export { default } from "next-auth/middleware";

export const config = {
    matcher : [ "/app/:path*" ],
};