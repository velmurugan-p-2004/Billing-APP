// import React from 'react';
import { useTranslation } from 'react-i18next';

export const Dashboard = () => {
    const { t } = useTranslation();
    return <div className="p-4"><h1 className="text-2xl font-bold">{t('dashboard')}</h1></div>;
}

export const Inventory = () => {
    const { t } = useTranslation();
    return <div className="p-4"><h1 className="text-2xl font-bold">{t('inventory')}</h1></div>;
}

export const Billing = () => {
    const { t } = useTranslation();
    return <div className="p-4"><h1 className="text-2xl font-bold">{t('billing')}</h1></div>;
}

export const HistoryPage = () => {
    const { t } = useTranslation();
    return <div className="p-4"><h1 className="text-2xl font-bold">{t('history')}</h1></div>;
}

export const Settings = () => {
    const { t } = useTranslation();
    return <div className="p-4"><h1 className="text-2xl font-bold">{t('settings')}</h1></div>;
}
