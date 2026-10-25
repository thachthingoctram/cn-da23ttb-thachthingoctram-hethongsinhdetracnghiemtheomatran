document.addEventListener("DOMContentLoaded", async () => {
    const components = [
        {
            id: "sidebar-container",
            url: "/components/sidebar.html",
        },
        {
            id: "header-container",
            url: "/components/header.html",
        },
        {
            id: "footer-container",
            url: "/components/footer.html",
        },
    ];

    // Nạp các thành phần dùng chung
    for (const component of components) {
        const container = document.getElementById(component.id);

        if (!container) continue;

        try {
            const response = await fetch(component.url);

            if (!response.ok) {
                throw new Error(`Không tải được ${component.url}`);
            }

            container.innerHTML = await response.text();
        } catch (error) {
            console.error(error);
        }
    }

    // Đánh dấu menu tương ứng với trang hiện tại
    const currentPath = window.location.pathname;

    document.querySelectorAll(".side-nav .nav-link").forEach((link) => {
        const href = link.getAttribute("href");

        link.classList.toggle(
            "active",
            href === currentPath || (currentPath === "/" && href === "/"),
        );
    });

    // Mở/đóng sidebar trên màn hình nhỏ
    document.getElementById("menuToggle")?.addEventListener("click", () => {
        document.getElementById("sidebar")?.classList.toggle("open");
    });
});
