import { Navbar, Hero, Features, Pricing, Footer } from '../components/landing'

export default function Landing() {
  return (
    <div className="bg-white">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Pricing />
      </main>
      <Footer />
    </div>
  )
}
