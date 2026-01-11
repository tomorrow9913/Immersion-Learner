# Immersion Learner - Chrome Extension

Immersion Learner is a powerful Chrome extension designed to enhance your language learning experience by providing in-context translations, study tools, and PDF interaction capabilities directly in your browser.

This project is built with a modern tech stack including React, TypeScript, and Vite, ensuring a fast and reliable user experience.

## ✨ Features

- **📖 In-Page Translation**: Translate sentences and words on any webpage by hovering over them.
- **📄 PDF Reader**: Open and read PDF files directly in your browser with a custom reader interface.
- **✍️ PDF Highlighting**: Highlight important text within PDF documents.
- **🧠 Study Modes**:
    - **Flashcard Mode**: Create and review flashcards from the words you've saved.
    - **Quiz Mode**: Test your knowledge with automatically generated quizzes.
    - **Word List**: Keep a list of words you want to learn.
- **🚀 New Tab Override**: The new tab page is transformed into a dashboard for your learning activities.
- **🔧 Customizable**: Configure the extension to suit your learning style.

## Image
<img width="1899" height="801" alt="image" src="https://github.com/user-attachments/assets/cbf098bc-0214-4bf3-9cd8-12107f4a42a5" />
<img width="901" height="313" alt="image" src="https://github.com/user-attachments/assets/f226aad5-2421-46ce-bab3-9b31b84fa5bb" />
<img width="1897" height="806" alt="image" src="https://github.com/user-attachments/assets/aec8c087-2b6e-49b2-96e2-0fd28f5bfe7b" />
<img width="1914" height="811" alt="image" src="https://github.com/user-attachments/assets/57027ca8-ba8b-467b-a84e-5bc7665eb7aa" />
<img width="1895" height="806" alt="image" src="https://github.com/user-attachments/assets/fd08a8be-8a8a-4504-82db-324756fb5761" />
<img width="1894" height="804" alt="image" src="https://github.com/user-attachments/assets/020aa7ac-50bf-4fe3-b08e-06dd9532d53a" />
<img width="1898" height="804" alt="image" src="https://github.com/user-attachments/assets/704a62c8-c8f7-445b-9bda-e1544e94cdc9" />





## 🛠️ Tech Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Linting**: ESLint
- **Testing**: Vitest, React Testing Library
- **Chrome Extension**: Manifest V3 with `@crxjs/vite-plugin`

## 📦 Installation and Setup

To get started with developing Immersion Learner, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2.  **Install dependencies:**
    This project uses `npm`.
    ```bash
    npm install
    ```

3.  **Run the development server:**
    This command will start the Vite development server and build the extension for development.
    ```bash
    npm run dev
    ```

4.  **Load the extension in Chrome:**
    - Open Chrome and navigate to `chrome://extensions`.
    - Enable "Developer mode".
    - Click "Load unpacked" and select the `dist` directory that was generated in the project folder.

## ⚙️ How It Works

The extension is structured into several key parts:

- **`src/background`**: The service worker handles background tasks, such as managing context menus and orchestrating communication between different parts of the extension.
- **`src/content`**: The content script is injected into web pages to provide the in-page translation and text interaction features.
- **`src/pages`**: Contains the UI for the popup (`Popup.tsx`) and the new tab page (`NewTab.tsx`).
- **`src/components`**: Reusable React components are organized by feature (e.g., `pdf`, `study`).
    - **`pdf`**: Components for the PDF reader functionality.
    - **`study`**: Components for the Flashcard, Quiz, and Word List features.
- **`src/hooks`**: Custom hooks encapsulate complex logic, such as `useTranslation` for handling translations and `useHighlighting` for text highlighting.
- **`src/services`**: Services like `ApiService` manage external API calls.
- **`manifest.json`**: The manifest file defines the extension's capabilities, permissions, and entry points.

## 🤝 Contributing

We welcome contributions to Immersion Learner! If you'd like to contribute, please follow these steps:

1.  **Fork the repository.**
2.  **Create a new branch** for your feature or bug fix:
    ```bash
    git checkout -b feature/your-feature-name
    ```
3.  **Make your changes** and ensure that the code lints and tests pass:
    ```bash
    npm run lint
    npm run test
    ```
4.  **Commit your changes** with a clear and descriptive commit message.
5.  **Push your changes** to your forked repository.
6.  **Create a pull request** to the main repository's `main` branch.

Please ensure your code follows the existing code style and conventions.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for more details.
