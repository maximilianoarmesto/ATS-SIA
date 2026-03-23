export function Hero() {
  return (
    <div className="bg-gradient-to-r from-primary-600 to-primary-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            ATS - SIA
          </h1>
          <p className="text-xl md:text-2xl text-primary-100 mb-8 max-w-3xl mx-auto">
            Smart Interview Assistant - Streamline your recruitment process with our intelligent Applicant Tracking System
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button className="btn btn-lg bg-white text-primary-600 hover:bg-gray-50">
              Get Started
            </button>
            <button className="btn btn-lg bg-primary-700 text-white hover:bg-primary-800 border border-primary-500">
              Learn More
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}