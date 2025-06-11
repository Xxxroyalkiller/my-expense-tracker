// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, onSnapshot, deleteDoc, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Your Firebase project configuration (REPLACE THIS WITH YOUR ACTUAL CONFIG)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // Replace with your actual API Key
    authDomain: "YOUR_AUTH_DOMAIN", // Replace with your actual Auth Domain
    projectId: "YOUR_PROJECT_ID", // Replace with your actual Project ID
    storageBucket: "YOUR_STORAGE_BUCKET", // Replace with your actual Storage Bucket
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your actual Messaging Sender ID
    appId: "YOUR_APP_ID", // Replace with your actual App ID
    measurementId: "YOUR_MEASUREMENT_ID" // Replace with your actual Measurement ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM element references
const expenseDateInput = document.getElementById('expenseDate');
const expenseCategoryInput = document.getElementById('expenseCategory');
const expenseDescriptionInput = document.getElementById('expenseDescription');
const expenseAmountInput = document.getElementById('expenseAmount');
const paymentMethodInput = document.getElementById('paymentMethod');
const paidByInput = document.getElementById('paidBy');
const hasBillInput = document.getElementById('hasBill');
const billTypeContainer = document.getElementById('billTypeContainer');
const billTypeInput = document.getElementById('billType');
const addExpenseBtn = document.getElementById('addExpenseBtn');
const expenseTableBody = document.getElementById('expenseTableBody');
const totalExpenditureSpan = document.getElementById('totalExpenditure');
const getInsightsBtn = document.getElementById('getInsightsBtn');
const insightsDisplay = document.getElementById('insightsDisplay');
const expenseCategoryChartCtx = document.getElementById('expenseCategoryChart').getContext('2d');
const expenseMonthlyChartCtx = document.getElementById('expenseMonthlyChart').getContext('2d');
const monthSelect = document.getElementById('monthSelect');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');

const authButton = document.getElementById('authButton');
const guestButton = document.getElementById('guestButton');
const userInfoDiv = document.getElementById('userInfo');

const mainAppContainer = document.getElementById('mainAppContainer');
const loginScreen = document.getElementById('loginScreen');
const signOutButton = document.getElementById('signOutButton');

const loadingOverlay = document.getElementById('loadingOverlay');

// NEW: Profile and Settings elements
const userProfileCircle = document.getElementById('userProfileCircle');
const userEmailTooltip = document.getElementById('userEmailTooltip');
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
const requiredFieldsList = document.getElementById('requiredFieldsList');
const customFieldsList = document.getElementById('customFieldsList');
const noCustomFieldsMessage = document.getElementById('noCustomFieldsMessage');
const addCustomFieldBtn = document.getElementById('addCustomFieldBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const expenseInputFormGrid = document.getElementById('expenseInputFormGrid');
const customFieldsContainer = document.getElementById('customFieldsContainer');
const customFieldHeaders = document.getElementById('customFieldHeaders');


// Global state variables
let expenses = [];
let currentUserId = null;
let unsubscribeFromExpenses = null;

// Exchange rates (CAD as base) - these are hardcoded for simplicity
const EXCHANGE_RATE_CAD_TO_AED = 2.70;
const EXCHANGE_RATE_CAD_TO_INR = 61.00;

// Chart instances
let expenseCategoryPieChart;
let expenseMonthlyBarChart;

// NEW: App Settings State
const CORE_FIELDS = [
    { id: 'expenseDate', label: 'Date', type: 'date', placeholder: '' },
    { id: 'expenseCategory', label: 'Category', type: 'text', placeholder: 'e.g., Groceries, Rent' },
    { id: 'expenseDescription', label: 'Description', type: 'text', placeholder: 'e.g., Weekly shopping' },
    { id: 'expenseAmount', label: 'Amount (CAD)', type: 'number', placeholder: 'e.g., 50.00' },
    { id: 'paymentMethod', label: 'Payment Method', type: 'select', options: ['Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Online Payment', 'Other'] },
    { id: 'paidBy', label: 'Paid By', type: 'text', placeholder: 'e.g., John, Sarah' },
    { id: 'hasBill', label: 'Do you have the bill?', type: 'checkbox' },
    { id: 'billType', label: 'Bill Type', type: 'select', options: ['Physical', 'Digital'] }
];

let appSettings = {
    requiredFields: { // Default required status for core fields
        expenseDate: true,
        expenseCategory: true,
        expenseDescription: true,
        expenseAmount: true,
        paymentMethod: true,
        paidBy: false, // Optional by default
        hasBill: false, // Optional by default
        billType: false // Optional by default
    },
    customFields: [] // Array to store definitions of custom fields
};

// --- Loading Overlay Functions ---
function showLoading(message = "Loading...") {
    loadingOverlay.classList.remove('hidden');
    loadingOverlay.querySelector('p').textContent = message;
}

function hideLoading() {
    loadingOverlay.classList.add('hidden');
}

// --- Authentication Functions ---
authButton.addEventListener('click', async () => {
    try {
        showLoading("Signing in with Google...");
        await signInWithPopup(auth, provider);
        showMessage('Signed in successfully with Google!', 'success');
    } catch (error) {
        console.error('Error signing in with Google:', error);
        let errorMessage = 'Failed to sign in with Google.';
        if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'Sign-in cancelled by user.';
        } else if (error.message) {
            errorMessage += ` Error: ${error.message}`;
        }
        showMessage(errorMessage, 'error');
    } finally {
        hideLoading();
    }
});

guestButton.addEventListener('click', async () => {
    try {
        showLoading("Signing in as Guest...");
        await signInAnonymously(auth);
        showMessage('Signed in successfully as Guest!', 'success');
    } catch (error) {
        console.error('Error signing in anonymously:', error);
        showMessage('Failed to sign in as guest. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});

signOutButton.addEventListener('click', async () => {
    try {
        showLoading("Signing out...");
        await signOut(auth);
        showMessage('Signed out successfully!', 'success');
    } catch (error) {
        console.error('Error signing out:', error);
        showMessage('Error signing out. Please try again.', 'error');
    } finally {
        hideLoading();
    }
});


// --- Firebase Auth State Listener ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        
        // Update user info for login screen (will be hidden)
        userInfoDiv.textContent = user.isAnonymous ? 'Welcome, Guest!' : `Welcome, ${user.displayName || user.email}!`;

        // Hide login screen, show main application
        loginScreen.classList.add('hidden');
        mainAppContainer.classList.remove('hidden');

        // NEW: Load settings and render UI
        await loadUserSettings();
        renderUserProfile(user);
        renderExpenseForm(); // Render form based on loaded settings
        
        console.log('User signed in:', user.uid, 'Anonymous:', user.isAnonymous);
        
        listenToExpenses(user.uid);
    } else {
        currentUserId = null;
        userInfoDiv.textContent = 'Please sign in to save your data.';

        mainAppContainer.classList.add('hidden');
        loginScreen.classList.remove('hidden');

        console.log('User signed out.');

        expenses = [];
        renderExpenses(); // Re-render to clear table and charts
        if (unsubscribeFromExpenses) {
            unsubscribeFromExpenses();
        }
        // Reset settings to default when signed out
        appSettings = {
            requiredFields: Object.assign({}, appSettings.requiredFields, { // Keep initial core field required status
                expenseDate: true,
                expenseCategory: true,
                expenseDescription: true,
                expenseAmount: true,
                paymentMethod: true,
                paidBy: false,
                hasBill: false,
                billType: false
            }),
            customFields: []
        };
        renderExpenseForm(); // Re-render form with default settings
        renderUserProfile(null); // Clear profile circle
        showMessage('Your data will be available when you sign in.', 'info');
    }
    hideLoading();
});

// NEW: Render User Profile Circle
function renderUserProfile(user) {
    userProfileCircle.innerHTML = ''; // Clear previous content
    if (user) {
        const initials = (user.displayName || user.email || 'Guest').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
        userProfileCircle.textContent = initials;
        userEmailTooltip.textContent = user.isAnonymous ? 'Guest User' : user.email;
        userProfileCircle.classList.remove('hidden');
    } else {
        userProfileCircle.classList.add('hidden'); // Hide if no user
        userEmailTooltip.textContent = '';
    }
}

// --- Firestore Settings Logic ---
async function loadUserSettings() {
    if (!currentUserId) return;
    showLoading("Loading settings...");
    try {
        const settingsDocRef = doc(db, `users/${currentUserId}/settings/appConfig`);
        const docSnap = await getDoc(settingsDocRef);

        if (docSnap.exists()) {
            const loadedSettings = docSnap.data();
            // Merge loaded settings with default structure to ensure all keys are present
            appSettings.requiredFields = { ...appSettings.requiredFields, ...loadedSettings.requiredFields };
            appSettings.customFields = loadedSettings.customFields || [];
            console.log("Settings loaded:", appSettings);
            showMessage('Settings loaded!', 'success');
        } else {
            console.log("No custom settings found for this user, using defaults.");
            // Save default settings if they don't exist
            await saveUserSettings();
        }
    } catch (error) {
        console.error("Error loading settings:", error);
        showMessage("Error loading settings.", "error");
    } finally {
        hideLoading();
    }
}

async function saveUserSettings() {
    if (!currentUserId) return;
    showLoading("Saving settings...");
    try {
        const settingsDocRef = doc(db, `users/${currentUserId}/settings/appConfig`);
        await setDoc(settingsDocRef, appSettings, { merge: true }); // Use merge to avoid overwriting other potential settings
        console.log("Settings saved:", appSettings);
        showMessage('Settings saved!', 'success');
    } catch (error) {
        console.error("Error saving settings:", error);
        showMessage("Error saving settings.", "error");
    } finally {
        hideLoading();
    }
}

// --- Settings Modal UI & Logic ---
settingsButton.addEventListener('click', openSettingsModal);
closeSettingsModalBtn.addEventListener('click', closeSettingsModal);
saveSettingsBtn.addEventListener('click', saveSettingsAndRefreshUI);
addCustomFieldBtn.addEventListener('click', promptForNewCustomField);

function openSettingsModal() {
    settingsModal.classList.remove('hidden');
    renderRequiredFieldsSettings();
    renderCustomFieldsSettings();
}

function closeSettingsModal() {
    settingsModal.classList.add('hidden');
}

async function saveSettingsAndRefreshUI() {
    closeSettingsModal();
    await saveUserSettings();
    renderExpenseForm(); // Re-render the expense form fields
    renderExpenses(); // Re-render table headers if needed (though not implemented yet for custom fields)
}

function renderRequiredFieldsSettings() {
    requiredFieldsList.innerHTML = '';
    CORE_FIELDS.forEach(field => {
        const div = document.createElement('div');
        div.className = 'settings-checkbox-container';
        div.innerHTML = `
            <input type="checkbox" id="req-${field.id}" data-field-id="${field.id}" ${appSettings.requiredFields[field.id] ? 'checked' : ''} class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500">
            <label for="req-${field.id}" class="text-gray-700">${field.label}</label>
        `;
        div.querySelector('input').addEventListener('change', (e) => {
            appSettings.requiredFields[field.id] = e.target.checked;
        });
        requiredFieldsList.appendChild(div);
    });
}

function renderCustomFieldsSettings() {
    customFieldsList.innerHTML = '';
    if (appSettings.customFields.length === 0) {
        noCustomFieldsMessage.classList.remove('hidden');
    } else {
        noCustomFieldsMessage.classList.add('hidden');
        appSettings.customFields.forEach((field, index) => {
            const div = document.createElement('div');
            div.className = 'field-row';
            div.innerHTML = `
                <span class="field-label">${field.label} (${field.type}${field.required ? ', Required' : ''})</span>
                <div class="field-actions">
                    <button class="edit-btn" data-index="${index}">Edit</button>
                    <button class="remove-btn" data-index="${index}">Remove</button>
                </div>
            `;
            div.querySelector('.edit-btn').addEventListener('click', () => editCustomField(index));
            div.querySelector('.remove-btn').addEventListener('click', () => removeCustomField(index));
            customFieldsList.appendChild(div);
        });
    }
}

function promptForNewCustomField() {
    const fieldLabel = prompt("Enter a label for the new field (e.g., 'Project Name'):");
    if (!fieldLabel) return;

    const fieldType = prompt("Enter the type of field (text, number, date, select, checkbox):").toLowerCase();
    if (!['text', 'number', 'date', 'select', 'checkbox'].includes(fieldType)) {
        alert("Invalid field type. Please enter 'text', 'number', 'date', 'select', or 'checkbox'.");
        return;
    }

    let fieldOptions = [];
    if (fieldType === 'select') {
        const optionsString = prompt("Enter comma-separated options for the select field (e.g., 'Option1,Option2,Option3'):");
        if (!optionsString) {
            alert("Select field requires options.");
            return;
        }
        fieldOptions = optionsString.split(',').map(o => o.trim());
    }

    const isRequired = confirm(`Should "${fieldLabel}" be a required field?`);

    const newField = {
        id: `customField_${Date.now()}`, // Unique ID
        label: fieldLabel,
        type: fieldType,
        placeholder: fieldType === 'text' ? `Enter ${fieldLabel.toLowerCase()}` : '',
        required: isRequired,
        options: fieldOptions.length > 0 ? fieldOptions : undefined
    };

    appSettings.customFields.push(newField);
    renderCustomFieldsSettings();
    showMessage('New custom field added to settings. Click Save Settings to apply.', 'info');
}

function editCustomField(index) {
    const field = appSettings.customFields[index];
    if (!field) return;

    const newLabel = prompt(`Edit label for "${field.label}":`, field.label);
    if (newLabel === null) return; // User cancelled

    const newRequired = confirm(`Should "${newLabel}" be a required field? (Currently ${field.required ? 'Yes' : 'No'})`);

    // For simplicity, I'm not allowing changing type or options here.
    // A more complex UI would be needed for that.

    field.label = newLabel;
    field.required = newRequired;
    renderCustomFieldsSettings();
    showMessage('Custom field updated in settings. Click Save Settings to apply.', 'info');
}

function removeCustomField(index) {
    if (confirm(`Are you sure you want to remove the field "${appSettings.customFields[index].label}"? This will also remove any data associated with it from future expense entries.`)) {
        appSettings.customFields.splice(index, 1);
        renderCustomFieldsSettings();
        showMessage('Custom field removed from settings. Click Save Settings to apply.', 'info');
    }
}


// --- Dynamic Expense Form Rendering ---
function renderExpenseForm() {
    // Update required asterisks for CORE_FIELDS
    CORE_FIELDS.forEach(field => {
        const labelSpan = document.getElementById(`label-${field.id}`);
        const asterisk = labelSpan ? labelSpan.nextElementSibling : null; // Get the asterisk
        if (asterisk) {
            if (appSettings.requiredFields[field.id]) {
                asterisk.classList.remove('hidden');
            } else {
                asterisk.classList.add('hidden');
            }
        }
    });

    // Render custom fields
    customFieldsContainer.innerHTML = '';
    appSettings.customFields.forEach(field => {
        const div = document.createElement('div');
        let inputHtml = '';
        let isRequired = field.required ? 'required' : '';
        let asteriskHtml = field.required ? '<span class="required-asterisk text-red-500 ml-1">*</span>' : '';

        switch (field.type) {
            case 'text':
            case 'number':
            case 'date':
                inputHtml = `<input type="${field.type}" id="${field.id}" placeholder="${field.placeholder || ''}" class="app-input" ${isRequired}>`;
                break;
            case 'select':
                inputHtml = `<select id="${field.id}" class="app-input app-select" ${isRequired}>
                    <option value="">Select ${field.label}</option>
                    ${field.options.map(option => `<option value="${option}">${option}</option>`).join('')}
                </select>`;
                break;
            case 'checkbox':
                inputHtml = `<input type="checkbox" id="${field.id}" class="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500" ${isRequired}>`;
                // For checkbox, label and input might be different
                div.className = "col-span-full md:col-span-2 lg:col-span-1 flex items-center mt-3";
                div.innerHTML = `
                    ${inputHtml}
                    <label for="${field.id}" class="ml-2 block text-sm font-medium text-gray-600">${field.label}${asteriskHtml}</label>
                `;
                customFieldsContainer.appendChild(div);
                return; // Skip default append below
            default:
                inputHtml = `<input type="text" id="${field.id}" placeholder="${field.placeholder || ''}" class="app-input" ${isRequired}>`;
        }

        div.innerHTML = `
            <label for="${field.id}" class="block text-sm font-medium text-gray-600 mb-1">${field.label}${asteriskHtml}</label>
            ${inputHtml}
        `;
        customFieldsContainer.appendChild(div);
    });
    // Ensure the main form grid knows about the new custom field container
    expenseInputFormGrid.appendChild(customFieldsContainer);
    
    // Update table headers for custom fields
    renderCustomFieldHeaders();
}

function renderCustomFieldHeaders() {
    // Clear existing custom headers (if any were added)
    customFieldHeaders.innerHTML = ''; 
    const newHeaders = document.createDocumentFragment();
    appSettings.customFields.forEach(field => {
        const th = document.createElement('th');
        th.setAttribute('scope', 'col');
        th.textContent = field.label;
        newHeaders.appendChild(th);
    });
    customFieldHeaders.appendChild(newHeaders);
}

// Event listener for hasBill checkbox
hasBillInput.addEventListener('change', () => {
    if (hasBillInput.checked) {
        billTypeContainer.style.display = 'block';
    } else {
        billTypeContainer.style.display = 'none';
        billTypeInput.value = ''; // Clear bill type when unchecked
    }
});
        
function getExpenseFormData() {
    const formData = {
        date: expenseDateInput.value,
        category: expenseCategoryInput.value.trim(),
        description: expenseDescriptionInput.value.trim(),
        amount: parseFloat(expenseAmountInput.value),
        paymentMethod: paymentMethodInput.value,
        paidBy: paidByInput.value.trim(),
        hasBill: hasBillInput.checked,
        billType: hasBillInput.checked ? billTypeInput.value : ''
    };

    // Collect custom field values
    appSettings.customFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            if (field.type === 'checkbox') {
                formData[field.id] = element.checked;
            } else if (field.type === 'number') {
                formData[field.id] = parseFloat(element.value) || 0; // Handle empty/invalid numbers
            } else {
                formData[field.id] = element.value.trim();
            }
        }
    });
    return formData;
}

function clearForm() {
    expenseDateInput.value = new Date().toISOString().split('T')[0]; // Reset to today
    expenseCategoryInput.value = '';
    expenseDescriptionInput.value = '';
    expenseAmountInput.value = '';
    paymentMethodInput.value = '';
    paidByInput.value = '';
    hasBillInput.checked = false;
    billTypeContainer.style.display = 'none';
    billTypeInput.value = '';

    // Clear custom fields
    appSettings.customFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            if (field.type === 'checkbox') {
                element.checked = false;
            } else {
                element.value = '';
            }
        }
    });
}

// --- Core Expense Logic (modified for dynamic validation/data) ---
async function addExpense() {
    if (!currentUserId) {
        showMessage("Please sign in or continue as guest to add expenses.", "error");
        return;
    }

    const formData = getExpenseFormData();
    const errors = validateExpenseForm(formData);

    if (errors.length > 0) {
        showMessage(`Please correct the following: ${errors.join(', ')}`, "error");
        return;
    }

    try {
        showLoading("Adding expense...");
        await addDoc(collection(db, `users/${currentUserId}/expenses`), {
            ...formData, // Spread all form data, including custom fields
            timestamp: new Date()
        });
        showMessage("Expense added successfully!", "success");
        clearForm();
    } catch (e) {
        console.error("Error adding document: ", e);
        showMessage("Failed to add expense. Please try again.", "error");
    } finally {
        hideLoading();
    }
}

function validateExpenseForm(formData) {
    const errors = [];

    // Validate core fields based on appSettings.requiredFields
    CORE_FIELDS.forEach(field => {
        const isRequired = appSettings.requiredFields[field.id];
        let value = formData[field.id];

        if (isRequired) {
            if (field.type === 'number') {
                if (isNaN(value) || value <= 0) {
                    errors.push(`${field.label} must be a positive number`);
                }
            } else if (field.type === 'checkbox') {
                if (!value) { // If checkbox is required, it must be checked
                    errors.push(`${field.label} must be checked`);
                }
            } else if (!value || String(value).trim() === '') {
                errors.push(`${field.label} is required`);
            }
        }
    });

    // Handle special logic for billType if hasBill is checked and billType is required
    if (formData.hasBill && appSettings.requiredFields.billType) {
        if (!formData.billType) {
            errors.push("Bill Type is required when 'Do you have the bill?' is checked");
        }
    }

    // Validate custom fields based on their definitions
    appSettings.customFields.forEach(field => {
        if (field.required) {
            let value = formData[field.id];
            if (field.type === 'number') {
                if (isNaN(value) || value === '') { // Allow empty string for number if not required, but if required, must be a number
                    errors.push(`${field.label} must be a number`);
                }
            } else if (field.type === 'checkbox') {
                if (!value) {
                    errors.push(`${field.label} must be checked`);
                }
            } else if (!value || String(value).trim() === '') {
                errors.push(`${field.label} is required`);
            }
        }
    });

    return errors;
}

// Add event listener for adding expense
addExpenseBtn.addEventListener('click', addExpense);

function listenToExpenses(userId) {
    // Unsubscribe from previous listener if exists
    if (unsubscribeFromExpenses) {
        unsubscribeFromExpenses();
    }

    if (!userId) {
        console.log("No user ID to listen to expenses.");
        expenses = [];
        renderExpenses();
        return;
    }

    const expensesCollectionRef = collection(db, `users/${userId}/expenses`);
    const q = query(expensesCollectionRef);

    unsubscribeFromExpenses = onSnapshot(q, (snapshot) => {
        expenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log("Expenses updated:", expenses);
        renderExpenses();
    }, (error) => {
        console.error("Error listening to expenses:", error);
        showMessage("Error loading expenses. Please try refreshing.", "error");
    });
}

function renderExpenses() {
    expenseTableBody.innerHTML = '';
    let total = 0;

    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

    expenses.forEach((expense) => {
        const amountCAD = expense.amount;
        const amountAED = (amountCAD * EXCHANGE_RATE_CAD_TO_AED).toFixed(2);
        const amountINR = (amountCAD * EXCHANGE_RATE_CAD_TO_INR).toFixed(2);

        total += amountCAD;

        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        let customFieldCells = '';
        appSettings.customFields.forEach(field => {
            const fieldValue = expense[field.id] !== undefined ? expense[field.id] : 'N/A';
            let displayValue = fieldValue;
            if (field.type === 'checkbox') {
                displayValue = fieldValue ? 'Yes' : 'No';
            }
            customFieldCells += `<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${displayValue}</td>`;
        });

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${expense.date}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700 capitalize">${expense.category}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${expense.description}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">C$${amountCAD.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">AED ${amountAED}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">INR ${amountINR}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${expense.paymentMethod || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${expense.paidBy || 'N/A'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${expense.hasBill ? 'Yes' : 'No'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${expense.hasBill && expense.billType ? expense.billType : 'N/A'}</td>
            ${customFieldCells}
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button data-id="${expense.id}" class="delete-btn text-red-500 hover:text-red-700 focus:outline-none">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm6 10a1 1 0 100-2H7a1 1 0 100 2h6z" clip-rule="evenodd" />
                    </svg>
                </button>
            </td>
        `;
        expenseTableBody.appendChild(row);
    });

    totalExpenditureSpan.textContent = `C$${total.toFixed(2)}`;
    updateMonthDropdown();
    renderCategoryPieChart();
    renderMonthlyBarChart();

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => deleteExpense(e.currentTarget.dataset.id));
    });
}

async function deleteExpense(expenseId) {
    if (!currentUserId) {
        showMessage("You must be signed in or continued as guest to delete expenses.", "error");
        return;
    }

    if (confirm("Are you sure you want to delete this expense?")) {
        try {
            showLoading("Deleting expense...");
            await deleteDoc(doc(db, `users/${currentUserId}/expenses`, expenseId));
            showMessage("Expense deleted successfully!", "success");
        } catch (e) {
            console.error("Error deleting document: ", e);
            showMessage("Failed to delete expense. Please try again.", "error");
        } finally {
            hideLoading();
        }
    }
}

function showMessage(message, type) {
    const existingMessage = document.getElementById('appMessage');
    if (existingMessage) {
        existingMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.id = 'appMessage';
    messageDiv.textContent = message;
    messageDiv.className = `fixed bottom-4 right-4 p-4 rounded-lg shadow-lg text-white font-medium text-sm z-50 transition-all duration-300 ease-in-out transform translate-y-0`;

    if (type === 'success') {
        messageDiv.classList.add('bg-green-500', 'message-success');
    } else if (type === 'error') {
        messageDiv.classList.add('bg-red-500', 'message-error');
    } else if (type === 'info') {
        messageDiv.classList.add('bg-blue-500', 'message-info');
    } else {
        messageDiv.classList.add('bg-gray-700');
    }
    
    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.classList.add('translate-y-full', 'opacity-0');
        messageDiv.addEventListener('transitionend', () => messageDiv.remove());
    }, 3000);
}

// --- Chart Rendering ---
function generateColors(numColors) {
    const colors = [
        'rgb(0, 122, 255)',  // Apple Blue
        'rgb(52, 199, 89)',  // Apple Green
        'rgb(175, 82, 222)', // Apple Purple
        'rgb(255, 149, 0)',  // Apple Orange
        'rgb(255, 59, 48)',  // Apple Red
        'rgb(88, 86, 214)',  // Apple Indigo
        'rgb(94, 92, 230)',  // Lighter Indigo
        'rgb(0, 199, 190)',  // Apple Teal
        'rgb(255, 204, 0)',  // Apple Yellow
        'rgb(69, 203, 133)', // Another Green
        'rgb(28, 163, 236)', // Bright Blue
        'rgb(255, 45, 85)',  // Hot Pink
        'rgb(80, 200, 239)', // Light Blue
        'rgb(255, 230, 30)', // Gold
        'rgb(153, 102, 255)',// Light Purple
    ];
    // If more colors are needed than defined, generate new ones based on a base set
    if (numColors > colors.length) {
        const newColors = [...colors];
        for (let i = colors.length; i < numColors; i++) {
            const baseColor = colors[i % colors.length]; // Cycle through base colors
            // Adjust hue, saturation, lightness slightly to get variations
            const colorParts = baseColor.match(/\d+/g).map(Number);
            newColors.push(`rgb(${colorParts[0] + (i * 10 % 50)}, ${colorParts[1] + (i * 15 % 50)}, ${colorParts[2] + (i * 20 % 50)})`);
        }
        return newColors;
    }
    return colors.slice(0, numColors);
}

function renderCategoryPieChart() {
    const categories = {};
    expenses.forEach(expense => {
        const category = expense.category || 'Uncategorized';
        categories[category] = (categories[category] || 0) + expense.amount;
    });

    const data = Object.values(categories);
    const labels = Object.keys(categories);
    const backgroundColors = generateColors(labels.length);

    if (expenseCategoryPieChart) {
        expenseCategoryPieChart.destroy();
    }

    expenseCategoryPieChart = new Chart(expenseCategoryChartCtx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#333',
                        font: {
                            size: 14
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += 'C$' + context.parsed.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderMonthlyBarChart() {
    const monthlyData = {};
    expenses.forEach(expense => {
        const date = new Date(expense.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyData[monthYear] = (monthlyData[monthYear] || 0) + expense.amount;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const data = sortedMonths.map(month => monthlyData[month]);
    const labels = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1, 1).toLocaleString('en-CA', { month: 'short', year: 'numeric' });
    });

    if (expenseMonthlyBarChart) {
        expenseMonthlyBarChart.destroy();
    }

    expenseMonthlyBarChart = new Chart(expenseMonthlyChartCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Expenditure (CAD)',
                data: data,
                backgroundColor: 'rgb(0, 122, 255, 0.8)', // Apple Blue with transparency
                borderColor: 'rgb(0, 122, 255)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount (CAD)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'C$' + value.toFixed(2);
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    }
                }
            },
            plugins: {
                legend: {
                    display: false // No legend needed for single bar dataset
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += 'C$' + context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// --- Insights (Gemini API Call) ---
getInsightsBtn.addEventListener('click', async () => {
    if (expenses.length === 0) {
        insightsDisplay.textContent = "Add some expenses first to get insights!";
        insightsDisplay.classList.remove('hidden');
        insightsDisplay.classList.add('bg-orange-100', 'text-orange-800', 'border-orange-300');
        return;
    }

    insightsDisplay.classList.remove('hidden', 'bg-orange-100', 'text-orange-800', 'border-orange-300', 'bg-red-100', 'text-red-800', 'border-red-300');
    insightsDisplay.classList.add('bg-purple-100', 'text-purple-800', 'border-purple-300');
    insightsDisplay.innerHTML = '<p class="font-medium">Analyzing your expenses...</p>';

    const expensesForGemini = expenses.map(e => {
        const baseData = {
            date: e.date,
            category: e.category,
            amount: e.amount,
            description: e.description
        };
        // Include custom fields in the data sent to Gemini
        appSettings.customFields.forEach(field => {
            if (e[field.id] !== undefined) {
                baseData[field.label] = e[field.id]; // Use label for clarity in prompt
            }
        });
        return baseData;
    });

    const prompt = `Analyze the following monthly expenses and provide key insights, trends, or advice.
    Focus on categories where spending is highest, potential areas for savings, and any unusual patterns.
    Consider that the user lives in Ontario, Canada, and amounts are in CAD.
    
    Expenses:
    ${JSON.stringify(expensesForGemini, null, 2)}`;

    try {
        const response = await fetch('http://localhost:3000/generate-content', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ prompt: prompt })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        insightsDisplay.innerHTML = `<p class="font-medium">${data}</p>`;
        insightsDisplay.classList.remove('hidden');
        insightsDisplay.classList.remove('bg-purple-100', 'text-purple-800', 'border-purple-300');
        insightsDisplay.classList.add('bg-green-50', 'text-green-800', 'border-green-200');
    } catch (error) {
        console.error('Error fetching insights from Gemini API:', error);
        insightsDisplay.innerHTML = '<p class="font-medium">Failed to fetch insights. Please ensure your Gemini API proxy server is running and accessible.</p>';
        insightsDisplay.classList.remove('hidden', 'bg-purple-100', 'text-purple-800', 'border-purple-300');
        insightsDisplay.classList.add('bg-red-100', 'text-red-800', 'border-red-300');
    }
});

// --- Download CSV ---
function updateMonthDropdown() { 
    monthSelect.innerHTML = '<option value="">Select a month...</option>';
    const uniqueMonths = new Set();
    expenses.forEach(expense => {
        const date = new Date(expense.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = new Date(date.getFullYear(), date.getMonth(), 1).toLocaleString('en-CA', { month: 'long', year: 'numeric' });
        uniqueMonths.add(`${monthKey}|${monthName}`);
    });

    Array.from(uniqueMonths).sort().forEach(item => {
        const [value, text] = item.split('|');
        const option = document.createElement('option');
        option.value = value;
        option.textContent = text;
        monthSelect.appendChild(option);
    });
}

downloadCsvBtn.addEventListener('click', () => {
    const selectedMonthKey = monthSelect.value;
    if (!selectedMonthKey) {
        showMessage("Please select a month to download.", "info");
        return;
    }

    const filteredExpenses = expenses.filter(expense => {
        const date = new Date(expense.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        return monthKey === selectedMonthKey;
    });

    if (filteredExpenses.length === 0) {
        showMessage("No expenses found for the selected month.", "info");
        return;
    }

    // CSV Headers
    let headers = ["Date", "Category", "Description", "Amount (CAD)", "Amount (AED)", "Amount (INR)", "Payment Method", "Paid By", "Has Bill?", "Bill Type"];
    appSettings.customFields.forEach(field => {
        headers.push(field.label); // Add custom field labels to headers
    });
    let csvContent = headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + "\n";

    // CSV Rows
    filteredExpenses.forEach(expense => {
        const amountCAD = expense.amount.toFixed(2);
        const amountAED = (expense.amount * EXCHANGE_RATE_CAD_TO_AED).toFixed(2);
        const amountINR = (expense.amount * EXCHANGE_RATE_CAD_TO_INR).toFixed(2);
        const hasBillText = expense.hasBill ? 'Yes' : 'No';
        const billTypeText = expense.hasBill && expense.billType ? expense.billType : '';

        let rowData = [
            expense.date,
            expense.category,
            expense.description,
            amountCAD,
            amountAED,
            amountINR,
            expense.paymentMethod,
            expense.paidBy,
            hasBillText,
            billTypeText
        ];

        // Add custom field values
        appSettings.customFields.forEach(field => {
            const fieldValue = expense[field.id] !== undefined ? expense[field.id] : '';
            let displayValue = fieldValue;
            if (field.type === 'checkbox') {
                displayValue = fieldValue ? 'Yes' : 'No';
            }
            rowData.push(displayValue);
        });

        csvContent += rowData.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const monthNameForFile = new Date(selectedMonthKey.split('-')[0], parseInt(selectedMonthKey.split('-')[1]) - 1, 1).toLocaleString('en-CA', { month: 'long', year: 'numeric' });
    link.setAttribute('href', url);
    link.setAttribute('download', `expenses_${monthNameForFile.replace(/\s/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage(`Expenses for ${monthNameForFile} downloaded!`, 'success');
});


// Initialize current date input with today's date
expenseDateInput.value = new Date().toISOString().split('T')[0];

// Initial setup for the loading overlay (ensure it's shown before auth check completes)
showLoading("Initializing app...");
