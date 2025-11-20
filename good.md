 .felt-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.2' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E"),
                radial-gradient(circle at 30% 20%, rgba(255,255,255,0.1) 0%, transparent 5%),
                radial-gradient(circle at 80% 60%, rgba(0,0,0,0.05) 0%, transparent 5%),
                linear-gradient(0deg, rgba(0,0,0,0.05) 50%, transparent 50%),
                linear-gradient(90deg, rgba(0,0,0,0.05) 50%, transparent 50%);
            background-size: 120px 120px, 200px 200px, 200px 200px, 4px 4px, 4px 4px;
            box-shadow: inset 0 0 250px rgba(62, 39, 35, 0.5);
            z-index: 1;
        }