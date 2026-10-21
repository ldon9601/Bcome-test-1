import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <h1>Work out where you&apos;re headed after school</h1>
      <p className="lead">
        Answer about 35 quick questions on what you enjoy and what matters to you. You&apos;ll get a plan that
        takes you from now to your first job, based on where Australian jobs are growing.
      </p>

      <ol className="hero-route" aria-label="What your plan covers">
        <li>
          <strong>Finish school strong</strong>
          Which subjects to choose, and what to try before you leave.
        </li>
        <li>
          <strong>Study and training</strong>
          University, TAFE or an apprenticeship: the routes into each career.
        </li>
        <li>
          <strong>Your first years at work</strong>
          The skills that will matter as jobs change over the next 5 to 15 years.
        </li>
      </ol>

      <Link href="/questionnaire" className="button">
        Start the questions
      </Link>
      <p className="muted" style={{ marginTop: "1rem" }}>
        Takes about 10 minutes. You can try it without an account; sign in to save your plan and share it with your
        careers adviser.
      </p>
    </main>
  );
}
