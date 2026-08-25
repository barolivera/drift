import { usePrivy } from '@privy-io/react-auth';

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function AuthButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) return <span className="text-ocean-300">…</span>;

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="rounded-full bg-ocean-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-ocean-700"
      >
        Log in
      </button>
    );
  }

  const label = user?.email?.address ?? (user?.wallet?.address ? short(user.wallet.address) : 'Account');
  return (
    <div className="flex items-center gap-3">
      <span className="text-ocean-700">{label}</span>
      <button onClick={logout} className="text-ocean-500 hover:underline">
        Log out
      </button>
    </div>
  );
}
