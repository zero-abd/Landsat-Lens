import React, { useState, useEffect } from 'react';
import { useAuth } from '../misc/auth-context';
import { db } from '../misc/firebase-config';
import { doc, getDoc } from 'firebase/firestore';
import { Icon } from '@iconify/react';

interface AcquisitionData {
    key: string;
    path: number;
    latitude?: number;
    longitude?: number;
    dates: {
        landsat_8: string;
        landsat_9: string;
    }[];
}

const LandsatTable: React.FC = () => {
    const [acquisitionData, setAcquisitionData] = useState<AcquisitionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<null | string>(null);
    const currentDate = new Date();
    const { currentUser } = useAuth();

    useEffect(() => {
        const fetchData = async () => {
            if (!currentUser?.email) {
                setError('No user authenticated');
                setLoading(false);
                return;
            }
            try {
                const docRef = doc(db, 'reminders', currentUser.email);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data()?.all || [];
                    setAcquisitionData(data);
                    setError(null);
                } else {
                    setError('No data found');
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Error fetching data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentUser]);

    if (loading) {
        return <div className="text-center">Loading...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    const renderTable = (satellite: 'landsat_8' | 'landsat_9') => (
        <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-center">{satellite === 'landsat_8' ? 'Landsat 8 Data' : 'Landsat 9 Data'}</h2>
            <div className="overflow-x-auto shadow-2lg rounded-2xl">
                <table className="min-w-full rounded-2xl">
                    <thead className="uppercase text-center leading-normal">
                        <tr>
                            <th className="py-4 px-6 text-center">No</th>
                            <th className="py-4 px-6 text-center">Path</th>
                            <th className="py-4 px-6 text-center">Latitude</th>
                            <th className="py-4 px-6 text-center">Longitude</th>
                            <th className="py-4 px-6 text-center">Date</th>
                            <th className="py-4 px-6 text-center">Collected Data</th>
                        </tr>
                    </thead>
                    <tbody className="text-center bg-white">
                        {acquisitionData.map((item, index) =>
                            item.dates.map((dateData: any, subIndex) => {
                                const isDataCollected = new Date(dateData[satellite]) < currentDate;

                                return (
                                    <tr key={`${index}-${subIndex}`} className="border-b border-gray-200 text-gray-700 text-sm hover:bg-gray-100 transition-all duration-200">
                                        <td className="py-4 px-6 text-center">{index + 1}</td>
                                        <td className="py-4 px-6 text-center">{item.key}</td>
                                        <td className="py-4 px-6 text-center">{item.latitude ?? 'N/A'}</td>
                                        <td className="py-4 px-6 text-center">{item.longitude ?? 'N/A'}</td>
                                        <td className="py-4 px-6 text-center">{dateData[satellite]}</td>
                                        <td className="py-4 px-6 text-center">
                                            {isDataCollected ? (
                                                <div className="flex items-center space-x-2 justify-center">
                                                    <a href="#" className="text-primary hover:text-primary" title="Download Data">
                                                        <Icon icon="material-symbols:download" width="20" height="20" />
                                                    </a>
                                                    <a href="#" className="text-primary hover:text-primary" title="View Data">
                                                        <Icon icon="hugeicons:view" width="20" height="20" />
                                                    </a>
                                                </div>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );

    return (
        <div className="container mx-auto p-4 max-w-4xl">
            {renderTable('landsat_8')}
            {renderTable('landsat_9')}
        </div>
    );
};

export default LandsatTable;
