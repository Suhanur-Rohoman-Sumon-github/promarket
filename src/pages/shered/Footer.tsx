import {
  Mail,
  
  Globe,
  ChevronDown,
  Music2,
  Gamepad2,
  InspectionPanel,
} from "lucide-react";

const marketColumns = [
  [
    { title: "Esports", subtitle: "Odds", href: "#" },
    { title: "Bitcoin", subtitle: "Predictions & odds", href: "#" },
    { title: "Earnings", subtitle: "Predictions", href: "#" },
    { title: "Perps", subtitle: "Perpetual futures", href: "#" },
    { title: "Political", subtitle: "Odds & predictions", href: "#" },
    { title: "World", subtitle: "Trends & predictions", href: "#" },
  ],
  [
    { title: "Weather", subtitle: "Odds & predictions", href: "#" },
    { title: "Crypto", subtitle: "Price predictions", href: "#" },
    { title: "Economic", subtitle: "Predictions & forecasts", href: "#" },
    { title: "Geopolitical", subtitle: "Predictions", href: "#" },
    { title: "Sports", subtitle: "Odds & predictions", href: "#" },
  ],
  [
    { title: "Election", subtitle: "Odds & predictions", href: "#" },
    { title: "Culture", subtitle: "Trends & predictions", href: "#" },
    { title: "Financial", subtitle: "Forecasts & predictions", href: "#" },
    { title: "Mention", subtitle: "Markets", href: "#" },
    { title: "Tech", subtitle: "Trends & predictions", href: "#" },
  ],
];

const supportLinks = [
  "Learn",
  "𝕏 (Twitter)",
  "Instagram",
  "Discord",
  "TikTok",
  "News",
  "Contact us",
  "Help Center",
  "Status",
];

const companyLinks = [
  "Rewards",
  "APIs",
  "Leaderboard",
  "Institutional",
  "Accuracy",
  "Brand",
  "Activity",
  "Careers",
  "Press",
];

const legalLinks = [
  "Privacy",
  "Terms of Use",
  "Market Integrity",
  "Transparency",
  "Help Center",
  "Docs",
];

export default function Footer() {
  return (
    <footer className="w-full bg-[#0e1015] text-white border-t border-white/5">
      <div className="max-w-[1600px] mx-auto px-5 md:px-8 py-8">
        {/* Brand */}
        <div className="mb-10">
          <a href="/" className="inline-flex items-center gap-3">
            <svg
              width="27"
              height="32"
              viewBox="0 0 27 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M2 6L24 1V15L2 20V6Z" stroke="white" strokeWidth="2.5" />
              <path
                d="M2 20L24 15V30L2 25V20Z"
                stroke="white"
                strokeWidth="2.5"
              />
            </svg>

            <span className="text-[25px] font-bold tracking-tight">
              Promarkets
            </span>
          </a>

          <p className="mt-2 text-[15px] font-semibold">
            The World's Largest Prediction Market™
          </p>
        </div>

        {/* Main footer content */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.43fr)] gap-12">
          {/* Market categories */}
          <div>
            <h3 className="text-sm text-[#b9c0ce] mb-4">
              Markets by category and topics
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-5">
              {marketColumns.map((column, index) => (
                <div key={index} className="flex flex-col gap-[14px]">
                  {column.map((item) => (
                    <a
                      key={item.title}
                      href={item.href}
                      className="group w-fit"
                    >
                      <p className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </p>

                      <p className="text-xs text-[#9ba5b8] mt-0.5">
                        {item.subtitle}
                      </p>
                    </a>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Support and company */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm text-[#b9c0ce] mb-4">Support & Social</h3>

              <div className="flex flex-col gap-[14px]">
                {supportLinks.map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="text-sm font-semibold text-white hover:text-blue-400 transition-colors"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm text-[#b9c0ce] mb-4">Promarkets</h3>

              <div className="flex flex-col gap-[14px]">
                {companyLinks.map((link) => (
                  <a
                    key={link}
                    href="#"
                    className="text-sm font-semibold text-white hover:text-blue-400 transition-colors"
                  >
                    {link}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Socials and legal navigation */}
        <div className="mt-10 flex flex-col xl:flex-row xl:items-center gap-6">
          {/* Social icons */}
          <div className="flex items-center gap-3 shrink-0">
            <a href="#" aria-label="Email">
              <Mail size={19} />
            </a>

            <a href="#" aria-label="X">
              <span className="text-xl font-medium">𝕏</span>
            </a>

            <a href="#" aria-label="Instagram">
              <InspectionPanel size={19} />
            </a>

            <a href="#" aria-label="Discord">
              <Gamepad2 size={19} />
            </a>

            <a href="#" aria-label="TikTok">
              <Music2 size={19} />
            </a>
          </div>

          {/* Copyright and links */}
          <div className="flex-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs md:text-sm">
            <span className="font-semibold whitespace-nowrap">
              Adventure One QSS Inc. © 2026
            </span>

            <span className="text-gray-500">·</span>

            {legalLinks.map((link, index) => (
              <span key={link} className="flex items-center gap-2">
                <a
                  href="#"
                  className="text-[#b7c1d3] hover:text-white transition-colors whitespace-nowrap"
                >
                  {link}
                </a>

                {index !== legalLinks.length - 1 && (
                  <span className="text-gray-500">·</span>
                )}
              </span>
            ))}
          </div>

          {/* Language selector */}
          <button className="flex items-center gap-2 text-sm font-semibold whitespace-nowrap xl:ml-auto">
            <Globe size={16} />
            English
            <ChevronDown size={15} />
          </button>
        </div>

        {/* Disclaimer */}
        <div className="mt-6 text-[12px] leading-[1.8] text-[#8995a9]">
          Promarkets operates globally through separate legal entities.
          <a href="#" className="underline mx-1 hover:text-white">
            Promarkets US
          </a>
          is operated by QCX LLC d/b/a Promarkets US, a CFTC-regulated
          Designated Contract Market. This international platform is not
          regulated by the CFTC and operates independently. Trading involves
          substantial risk of loss. See our
          <a href="#" className="underline mx-1 hover:text-white">
            Terms of Service
          </a>
          &
          <a href="#" className="underline ml-1 hover:text-white">
            Privacy Policy
          </a>
          .
        </div>
      </div>
    </footer>
  );
}
