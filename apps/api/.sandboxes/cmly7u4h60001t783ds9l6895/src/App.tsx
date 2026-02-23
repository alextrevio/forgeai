import { useState } from "react";

export default function App() {
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Hero Section */}
      <header className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <nav className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="text-2xl font-bold">MyApp</div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-indigo-200 transition-colors">Features</a>
            <a href="#about" className="hover:text-indigo-200 transition-colors">About</a>
            <button className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors">
              Get Started
            </button>
          </div>
        </nav>
        <div className="max-w-7xl mx-auto px-6 py-24 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 leading-tight">
            Build Something<br />
            <span className="text-indigo-200">Amazing Today</span>
          </h1>
          <p className="text-xl text-indigo-100 max-w-2xl mx-auto mb-10">
            The modern platform that helps you ship faster, iterate quickly,
            and delight your users with beautiful experiences.
          </p>
          <div className="flex items-center justify-center gap-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="px-5 py-3 rounded-lg text-gray-900 w-72 outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <button className="bg-indigo-500 hover:bg-indigo-400 px-6 py-3 rounded-lg font-semibold transition-colors">
              Start Free Trial
            </button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
            Powerful Features
          </h2>
          <p className="text-gray-600 text-center max-w-2xl mx-auto mb-16">
            Everything you need to build, launch, and grow your product.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Lightning Fast", desc: "Optimized for performance with sub-second load times and smooth interactions.", icon: "\u26A1" },
              { title: "Secure by Default", desc: "Enterprise-grade security with end-to-end encryption and SOC 2 compliance.", icon: "\uD83D\uDD12" },
              { title: "Scale Effortlessly", desc: "From prototype to millions of users without changing a single line of code.", icon: "\uD83D\uDE80" },
              { title: "Beautiful UI", desc: "Pre-built components and themes that look great on any device.", icon: "\uD83C\uDFA8" },
              { title: "API First", desc: "RESTful APIs and webhooks that integrate with your existing tools.", icon: "\uD83D\uDD17" },
              { title: "Analytics", desc: "Real-time dashboards and insights to understand your users better.", icon: "\uD83D\uDCCA" },
            ].map((feature) => (
              <div
                key={feature.title}
                className="bg-white p-8 rounded-xl shadow-sm hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-indigo-600 text-white text-center">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-indigo-100 text-lg mb-8">
            Join thousands of teams already building with MyApp.
          </p>
          <button className="bg-white text-indigo-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-indigo-50 transition-colors">
            Start Building for Free
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="text-white text-xl font-bold mb-4">MyApp</div>
              <p className="text-sm">
                Building the future of web development, one component at a time.
              </p>
            </div>
            <div>
              <h4 className="text-white font-medium mb-3">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Docs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-3">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">About</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-3">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-12 pt-8 text-sm text-center">
            &copy; 2026 MyApp. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
