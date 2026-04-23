/**
 * Microsoft 365 SKU Part Number → friendly name mapping
 * Reference: https://learn.microsoft.com/en-us/entra/identity/users/licensing-service-plan-reference
 */
export const LICENSE_NAMES = {
  // Microsoft 365 Business
  'O365_BUSINESS_ESSENTIALS':        'Microsoft 365 Business Basic',
  'SMB_BUSINESS_ESSENTIALS':         'Microsoft 365 Business Basic',
  'O365_BUSINESS_PREMIUM':           'Microsoft 365 Business Standard',
  'SMB_BUSINESS_PREMIUM':            'Microsoft 365 Business Standard',
  'SPB':                             'Microsoft 365 Business Premium',
  'SMB_BUSINESS':                    'Microsoft 365 Apps for Business',
  'O365_BUSINESS':                   'Microsoft 365 Apps for Business',

  // Microsoft 365 Enterprise
  'ENTERPRISEPACK':                  'Microsoft 365 E3',
  'ENTERPRISEPREMIUM':               'Microsoft 365 E5',
  'ENTERPRISEPREMIUM_NOPSTNCONF':    'Microsoft 365 E5 (sem conferência)',
  'ENTERPRISEPACKWITHOUTPROPLUS':    'Microsoft 365 E3 (sem Apps)',
  'SPE_E3':                          'Microsoft 365 E3',
  'SPE_E5':                          'Microsoft 365 E5',

  // Office 365
  'STANDARDPACK':                    'Office 365 E1',
  'ENTERPRISEPACKPLUS':              'Office 365 E3',
  'OFFICESUBSCRIPTION':              'Microsoft 365 Apps for Enterprise',
  'O365_BUSINESS_ESSENTIALS_FACULTY':'Office 365 A1 para Educação',

  // Exchange
  'EXCHANGESTANDARD':                'Exchange Online Plano 1',
  'EXCHANGEENTERPRISE':              'Exchange Online Plano 2',
  'EXCHANGEARCHIVE_ADDON':           'Exchange Online Archiving',
  'EXCHANGEDESKLESS':                'Exchange Online Kiosk',

  // Teams
  'TEAMS_EXPLORATORY':               'Microsoft Teams Exploratory',
  'TEAMS_FREE':                      'Microsoft Teams (Gratuito)',
  'MCOSTANDARD':                     'Skype for Business Online P2',

  // Azure AD / Entra
  'AAD_PREMIUM':                     'Microsoft Entra ID P1',
  'AAD_PREMIUM_P2':                  'Microsoft Entra ID P2',
  'RIGHTSMANAGEMENT':                'Azure Information Protection P1',

  // Intune / EMS
  'INTUNE_A':                        'Microsoft Intune',
  'EMS':                             'Enterprise Mobility + Security E3',
  'EMSPREMIUM':                      'Enterprise Mobility + Security E5',

  // Power Platform
  'POWER_BI_STANDARD':               'Power BI (Gratuito)',
  'POWER_BI_PRO':                    'Power BI Pro',
  'POWERAPPS_PER_USER':              'Power Apps por Usuário',
  'FLOW_PER_USER':                   'Power Automate por Usuário',

  // Outros
  'PROJECTPREMIUM':                  'Project Plano 5',
  'PROJECTPROFESSIONAL':             'Project Plano 3',
  'VISIOCLIENT':                     'Visio Plano 2',
  'DEVELOPERPACK':                   'Microsoft 365 E3 Developer',
  'DEVELOPERPACK_E5':                'Microsoft 365 E5 Developer',
};

export function friendlyLicense(skuPartNumber) {
  return LICENSE_NAMES[skuPartNumber] || skuPartNumber;
}
