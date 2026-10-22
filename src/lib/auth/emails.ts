import type { Email } from "./mailer.ts";

/**
 * Email wording. Emails carry as little personal information as possible: no names, school or
 * results, just what the person needs to act.
 */

const FOOTER = "\n\nIf you didn't ask for this, you can ignore this email. Bcome staff will never ask you for this code.\n\nBcome";

export function codeEmail(to: string, purpose: "verify_email" | "login" | "reset_password", code: string, minutes: number): Email {
  const intro = {
    verify_email: "Use this code to confirm your email address and finish setting up your Bcome account:",
    login: "Use this code to finish signing in to Bcome on a new device:",
    reset_password: "Use this code to reset your Bcome password:",
  }[purpose];
  const subject = {
    verify_email: "Confirm your email for Bcome",
    login: "Your Bcome sign-in code",
    reset_password: "Reset your Bcome password",
  }[purpose];
  return { to, subject, text: `${intro}\n\n    ${code}\n\nThe code expires in ${minutes} minutes.${FOOTER}` };
}

export function inviteEmail(to: string, schoolName: string, inviterName: string, link: string, days: number): Email {
  return {
    to,
    subject: `You're invited to join ${schoolName} on Bcome`,
    text: `${inviterName} has invited you to join ${schoolName} on Bcome as a careers adviser.\n\nSet up your account here (the link works once and expires in ${days} days):\n${link}${FOOTER}`,
  };
}

export function schoolApprovedEmail(to: string, schoolName: string, joinCode: string, appUrl: string): Email {
  return {
    to,
    subject: `${schoolName} is ready on Bcome`,
    text: `${schoolName} is now active on Bcome.\n\nStudents can create accounts at ${appUrl}/signup with their school email address and this school code:\n\n    ${joinCode}\n\nYou can change the code at any time from your dashboard.${FOOTER}`,
  };
}

export function passwordChangedEmail(to: string): Email {
  return {
    to,
    subject: "Your Bcome password was changed",
    text: "The password for your Bcome account was just changed, and you've been signed out on other devices.\n\nIf this wasn't you, reset your password straight away and tell your careers adviser.\n\nBcome",
  };
}

export function passwordLinkEmail(to: string, username: string, link: string, days: number, isNew: boolean): Email {
  return {
    to,
    subject: isNew ? "Your Bcome account is ready" : "Set a new Bcome password",
    text: `${isNew ? "A Bcome account has been set up for you." : "Here's a link to set a new password for your Bcome account."}\n\nYour username is: ${username}\n\nChoose your password here (the link works once and expires in ${days} days):\n${link}${FOOTER}`,
  };
}

export function testEmail(to: string, at: Date): Email {
  return { to, subject: "Bcome test email", text: `This is a test email from Bcome, sent at ${at.toISOString()}. Email delivery is working.\n\nBcome` };
}
