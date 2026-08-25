import { Link } from 'react-router-dom';

export function Home() {
  return (
    <section className="py-16 text-center">
      <h1 className="text-5xl font-semibold tracking-tight">
        Surf Brazil. <span className="text-ocean-500">Pay in crypto.</span>
      </h1>
      <p className="mx-auto mt-4 max-w-xl text-lg text-ocean-700">
        Curated surf trips from Santa Catarina to Bahia — lodging, boards, coaching and coworking. Book with USDC or PIX.
      </p>
      <Link
        to="/trips"
        className="mt-8 inline-block rounded-full bg-ocean-500 px-6 py-3 font-medium text-white hover:bg-ocean-700"
      >
        Browse trips
      </Link>
    </section>
  );
}
