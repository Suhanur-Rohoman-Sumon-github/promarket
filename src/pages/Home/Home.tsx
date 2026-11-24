import React from "react";
import { useNavigate } from "react-router-dom";
import PerpsDashboard from "./Banner";
import PolymarketExplorePage from "./Market";

type HomeEvent =
  | Parameters<NonNullable<React.ComponentProps<typeof PerpsDashboard>["onSelectEvent"]>>[0]
  | Parameters<NonNullable<React.ComponentProps<typeof PolymarketExplorePage>["onSelectEvent"]>>[0];

const Home: React.FC = () => {
  const navigate = useNavigate();

  const openMarket = (
    event: HomeEvent,
    marketId: string | null = null,
    side = "Yes",
  ): void => {
    navigate(`/event/${encodeURIComponent(event.slug ?? event.id)}`, {
      state: { event, marketId, side },
    });
  };

  const openRewards = (): void => {
    navigate("/rewards");
  };

  return (
    <div className="min-h-screen bg-[#0c0e13] text-white">
      <PerpsDashboard
        onSelectEvent={openMarket}
        onExploreAll={() =>
          document
            .getElementById("markets-grid")
            ?.scrollIntoView({ behavior: "smooth" })
        }
        onOpenRewards={openRewards}
      />
      <div id="markets-grid">
        <PolymarketExplorePage onSelectEvent={openMarket} />
      </div>
    </div>
  );
};

export default Home;
