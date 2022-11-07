let component;

export const editorFeature = (...args) => {
    return new Promise((resolve, reject) => {
        if (!component) {
            import("./component.js").then(({ EditorElement }) => {
                component = new EditorElement("test");
                document.body.insertAdjacentElement("beforeend", component);
            });
        }
    });
}
