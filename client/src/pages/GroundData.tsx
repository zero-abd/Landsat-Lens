import React from 'react';

const GroundBasedSpectralMeasurements: React.FC = () => {
    const handleSoilSpectroscopyClick = () => {
        window.open('https://soilspectroscopy.github.io/ossl-manual/', '_blank');
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-3xl font-bold mb-8 mt-12 text-center">Ground-Based Spectral Measurements</h1>
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">What is Ground-Based Spectral Measurement?</h2>
                <p className="">
                    Ground-based spectral measurements involve capturing the reflectance properties of soil, vegetation, and other ground-based targets. These measurements are crucial for calibrating
                    and validating remote sensing data from satellites, such as Landsat.
                </p>
            </section>
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">How to Collect Manually</h2>
                <p className="mb-4">Learn how to collect ground-based spectral measurements manually by referring to the Stella project by Landsat. Follow the instructions below:</p>
                <ul className="list-disc list-inside mb-4">
                    <li>Select a representative target area for measurement.</li>
                    <li>Ensure stable and consistent lighting conditions.</li>
                    <li>Calibrate your spectrometer using a known reference target.</li>
                    <li>Take multiple measurements of your target area and record the data.</li>
                    <li>Repeat the calibration periodically to ensure accuracy.</li>
                </ul>
                <p className="">
                    For detailed guidelines, visit the{' '}
                    <a href="https://landsat.gsfc.nasa.gov/stella/" target="_blank" className="text-primary hover:underline">
                        Landsat Stella Project
                    </a>
                    .
                </p>
            </section>
            <section className="mb-8">
                <h2 className="text-2xl font-semibold mb-4">Collect Using Soil.Spectroscopy</h2>
                <p className="mb-4">You can also collect spectral data using the Open Soil Spectral Library provided by Soil.Spectroscopy. Click the button below to access the OSSL manual:</p>
                <button className="bg-primary hover:bg-primary text-white font-bold py-2 px-4 rounded-xl" onClick={handleSoilSpectroscopyClick}>
                    OSSL Manual
                </button>
            </section>
        </div>
    );
};

export default GroundBasedSpectralMeasurements;
