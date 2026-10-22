import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice | Bcome" };

const CONTACT = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@bcome.example";

/** Collection notice under Australian Privacy Principle 5. Have it reviewed before launch (see docs/security/st4s-controls.md). */
export default function PrivacyPage() {
  return (
    <main className="page prose" style={{ maxWidth: "52rem" }}>
      <h1>
        Privacy <span className="grad-text">notice</span>
      </h1>
      <p className="lead">How Bcome collects, uses and protects information about students and school staff.</p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Students:</strong> first and last name, school email address, username, school, school year, and month and year of birth.
        </li>
        <li>
          <strong>Careers advisers:</strong> first and last name, school email address, username and school.
        </li>
        <li>
          <strong>Career Profile results:</strong> each time a student completes the questions, we keep their answers, their profile (interests,
          strengths, values, preferred ways of working, subjects) and the careers matched to them, so they and their advisers can see how this changes
          over time.
        </li>
        <li>
          <strong>Activities after the Career Profile:</strong> entries a student adds to their Skills Evidence Portfolio (what they did at school,
          in sport, at work or volunteering, with dates and skills), the weekly missions they complete with a short note and the points earned,
          which action cards they mark done, and which calendar events they mark as interesting. Calendar events are added by the school&apos;s
          careers advisers.
        </li>
        <li>
          <strong>Security records:</strong> a scrambled (hashed) password, sign-in sessions, trusted devices (a label such as &ldquo;Chrome on
          Windows&rdquo;), a log of sign-ins and account changes with the network (IP) address used, and a log of requests to Bcome (the page or action, the time, the IP address and browser type, never what was typed).
        </li>
      </ul>
      <p>
        We don&apos;t collect full dates of birth, home addresses, phone numbers, photos, gender, or health information, and we don&apos;t use
        advertising or tracking cookies. The portfolio asks students not to include phone numbers, addresses or health details. Contact details
        typed into the CV page stay in the student&apos;s browser and go only into the file they download.
      </p>

      <h2>Why we collect it</h2>
      <ul>
        <li>to give students career matches, pathways and a plan, and keep a history of their results;</li>
        <li>to give students weekly career missions, action cards, their school&apos;s opportunity calendar and a portfolio they can turn into a CV;</li>
        <li>so careers advisers at the student&apos;s own school can support their career planning;</li>
        <li>to produce school-level statistics for the school (for example, which careers and pathways interest their students);</li>
        <li>to keep accounts secure (for example, sign-in codes for new devices and records of sign-in attempts).</li>
      </ul>

      <h2>Who can see it</h2>
      <p>
        A student can see their own information. Careers advisers registered at the student&apos;s school can see that school&apos;s students. Other
        schools can&apos;t. Bcome staff only access information when needed to provide or support the service. We never sell information or use it for
        advertising.
      </p>
      <p>
        If a school turns on AI-written plans, we send a student&apos;s scores and matched careers (never their name, email or school) to our AI
        provider to word the plan. Schools can leave this off, in which case plans are written by Bcome&apos;s own templates.
      </p>

      <h2>Where it&apos;s stored and how it&apos;s protected</h2>
      <p>
        Information is stored in Australia (Sydney), encrypted in transit and at rest. Passwords are never stored, only a salted hash. Advisers confirm
        every sign-in with an emailed code, and students confirm new devices the same way. A small number of Bcome staff (platform administrators) can see accounts and results across schools to run and support the service; they also confirm every sign-in with a code, and everything they do is logged.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep an account and its results until the student or their school deletes it. Students can delete their account from their profile, and
        advisers can remove students who have left. Security logs are kept for about 13 months, and request logs for 30 days.
      </p>

      <h2>Access, correction and complaints</h2>
      <p>
        You can see and update your details from your profile, or ask your careers adviser. To ask for a copy of your information, make a correction or
        make a complaint, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. If you&apos;re not satisfied with our response, you can contact the Office
        of the Australian Information Commissioner (oaic.gov.au).
      </p>
    </main>
  );
}
