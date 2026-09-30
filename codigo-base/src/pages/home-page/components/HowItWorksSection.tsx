import { HOW_IT_WORKS } from "../data";

export default function HowItWorksSection() {
  return (
    <section
      className="px-6 md:px-16 py-24 my-8 mx-4 md:mx-16 rounded-3xl"
      style={{ background: "linear-gradient(135deg, #1A0F35 0%, #2D1A52 100%)", border: "1px solid rgba(164,134,213,0.2)" }}
    >
      <h2
        className="text-3xl md:text-4xl text-center mb-14"
        style={{ fontFamily: "var(--font-display)", color: "#FFCC00" }}
      >
        Como funciona a Athen?
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {HOW_IT_WORKS.map((item, i) => (
          <div key={item.step} className="flex flex-col gap-3">
            <div
              className="text-5xl font-bold mb-2"
              style={{ fontFamily: "var(--font-display)", color: i % 2 === 0 ? "#FFCC00" : "#A486D5", opacity: 0.4 }}
            >
              {item.step}
            </div>
            <h3
              className="text-xl leading-snug"
              style={{ fontFamily: "var(--font-display)", color: "#F4EEFF" }}
            >
              {item.title}
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "#A486D5", fontFamily: "var(--font-body)" }}>
              {item.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
