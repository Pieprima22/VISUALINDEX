function createGlobe() {
    const scene = new THREE.Scene();
    
    const width = window.innerWidth * 0.9;
    const height = window.innerHeight * 0.9;
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(width, height);
    renderer.setClearColor(0xffffff);

    // Create the globe
    const GLOBE_RADIUS = 5;
    const sphereGeometry = new THREE.SphereGeometry(GLOBE_RADIUS, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
        map: new THREE.TextureLoader().load('Map_lighten.png'),
    });
    const globe = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(globe);

    camera.position.z = 12;
    camera.position.y = 1;  // Positive value moves globe down

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // State variables
    let isMouseDown = false;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationVelocity = { x: 0, y: 0 };
    let targetRotation = { x: globe.rotation.x, y: globe.rotation.y };
    
    let currentZoom = camera.position.z;
    let targetZoom = currentZoom;
    const ZOOM_SPEED = 1;
    const MIN_ZOOM = 11;
    const MAX_ZOOM = 12;
    const ZOOM_SMOOTHING = 0.15;
    
    const DAMPING = 0.95;
    const INERTIA = 0.92;
    const ROTATION_SPEED = 0.002;

    const markerObjects = [];
    const hoverText = document.createElement('div');
    hoverText.style.cssText = `
        position: fixed;
        display: none;
        background: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 14px;
        pointer-events: none;
        z-index: 1000;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        font-family: 'AkkuratStd', sans-serif;

    `;
    document.body.appendChild(hoverText);

    // Add these new functions for search functionality
    function updateMarkersForSearch(query) {
        const searchQuery = query.toLowerCase();
        
        markerObjects.forEach(marker => {
            const project = marker.userData.project;
            const matches = project.title.toLowerCase().includes(searchQuery) ||
                          project.typology?.toLowerCase().includes(searchQuery) ||
                          project.program?.toLowerCase().includes(searchQuery) ||
                          project.location?.toLowerCase().includes(searchQuery);

            if (matches) {
                marker.visible = true;
                marker.scale.setScalar(1.2);
                marker.material.opacity = 1;
            } else {
                marker.visible = false;
                marker.scale.setScalar(1);
                marker.material.opacity = 0.5;
            }
            marker.material.needsUpdate = true;
        });
    }
    function resetAllMarkers() {
        markerObjects.forEach(marker => {
            marker.visible = true;
            marker.scale.setScalar(1);
            marker.material.opacity = 1;
            marker.material.needsUpdate = true;
        });
    }

    function filterMarkersByKeyword(keyword) {
        markerObjects.forEach(marker => {
            const project = marker.userData.project;
            const matches = project.typology === keyword || 
                          project.program === keyword || 
                          (keyword === "HIGH-RISE" && project.scale === "XL") ||
                          (keyword === "INTERIOR" && project.typology === "INTERIOR") ||
                          (keyword === "BUILT" && project.epoch === "PRESENT");

            if (matches) {
                marker.visible = true;
                marker.scale.setScalar(1.2);
                marker.material.opacity = 1;
            } else {
                marker.visible = false;
                marker.scale.setScalar(1);
                marker.material.opacity = 0.5;
            }
            marker.material.needsUpdate = true;
        });
    }


    function addLocationMarkers() {
        function latLngToVector3(lat, lng, radius) {
            const latRad = (lat * Math.PI) / 180;
            const lngRad = (-lng * Math.PI) / 180;
            
            const x = radius * Math.cos(latRad) * Math.cos(lngRad);
            const y = radius * Math.sin(latRad);
            const z = radius * Math.cos(latRad) * Math.sin(lngRad);
            
            return new THREE.Vector3(x, y, z);
        }

        const projectsByLocation = {};
        projects.forEach(project => {
            if (!projectsByLocation[project.location]) {
                projectsByLocation[project.location] = [];
            }
            projectsByLocation[project.location].push(project);
        });

        const locationCoords = {
            'DUBAI, UAE': { lat: 25.2048, lng: 55.2708 },
            'ABU DHABI': { lat: 24.4539, lng: 54.3773 },
            'MOROCCO': { lat: 31.7917, lng: -7.0926 },
            'QATAR': { lat: 25.3548, lng: 51.1839 },
            'KSA, SAUDI ARABIA': { lat: 23.8859, lng: 45.0792 },
            'BAHRAIN': { lat: 26.0667, lng: 50.5577 },
            'MUSCAT, OMAN': { lat: 23.5880, lng: 58.3829 },
            'PAKISTAN': { lat: 30.3753, lng: 69.3451 },
            'SHARJAH': { lat: 25.3463, lng: 55.4209 }
        };
        
        Object.entries(projectsByLocation).forEach(([location, locationProjects]) => {
            const coords = locationCoords[location];
            if (!coords) return;

            const basePosition = latLngToVector3(coords.lat, coords.lng, GLOBE_RADIUS);

            locationProjects.forEach((project, index) => {
                const markerSize = 0.4;
                const geometry = new THREE.PlaneGeometry(markerSize, markerSize);
                const texture = new THREE.TextureLoader().load(project.image);
                const hoverTexture = project.hoverImage ? new THREE.TextureLoader().load(project.hoverImage) : texture;
                
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide
                });

                const marker = new THREE.Mesh(geometry, material);
                
                marker.userData.defaultTexture = texture;
                marker.userData.hoverTexture = hoverTexture;
                
                const verticalOffset = index * (markerSize * 0.13);
                const offsetPosition = basePosition.clone();
                const up = offsetPosition.clone().normalize();
                offsetPosition.addScaledVector(up, verticalOffset);

                marker.position.copy(offsetPosition);
                marker.lookAt(offsetPosition.clone().multiplyScalar(2));
                
                const normalizedPosition = offsetPosition.clone().normalize();
                marker.position.addScaledVector(normalizedPosition, 0.01);

                marker.userData.project = project;
                markerObjects.push(marker);
                globe.add(marker);
            });
        });
    }
    let hoveredMarker = null;
function updateHoverEffects(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(markerObjects);

    renderer.domElement.style.cursor = intersects.length > 0 ? 'pointer' : 'grab';

    // First, handle the case when we're not hovering over any marker
    if (intersects.length === 0) {
        if (hoveredMarker) {
            // Reset the current hovered marker
            resetMarkerState(hoveredMarker);
            hoveredMarker = null;
        }
        hoverText.style.display = 'none';
        return;
    }

    const currentMarker = intersects[0].object;
    const project = currentMarker.userData.project;

    // If we're hovering over a different marker than before
    if (hoveredMarker !== currentMarker) {
        // Reset the previous marker if it exists
        if (hoveredMarker) {
            resetMarkerState(hoveredMarker);
        }

        // Set up the new hover state
        currentMarker.material.map = currentMarker.userData.hoverTexture;
        currentMarker.material.needsUpdate = true;
        currentMarker.scale.setScalar(1.8);
        hoveredMarker = currentMarker;

        // Update hover text
        hoverText.style.display = 'block';
        hoverText.textContent = project.title;
        hoverText.style.left = event.clientX + 15 + 'px';
        hoverText.style.top = event.clientY + 'px';
    } else {
        // Update hover text position if we're still hovering over the same marker
        hoverText.style.left = event.clientX + 15 + 'px';
        hoverText.style.top = event.clientY + 'px';
    }
}

// Add this helper function to properly reset marker state
function resetMarkerState(marker) {
    if (marker) {
        marker.material.map = marker.userData.defaultTexture;
        marker.material.needsUpdate = true;
        marker.scale.setScalar(1);
    }
}


    renderer.domElement.addEventListener('mousemove', updateHoverEffects);

    addLocationMarkers();


    function handleClick(event) {
        if (isDragging) return;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(markerObjects);

        if (intersects.length > 0) {
            const project = intersects[0].object.userData.project;
            if (project) {
                const currentMarker = intersects[0].object;
                openProjectModal(project, () => {
                    // Callback function that runs when modal closes
                    if (hoveredMarker) {
                        hoveredMarker.material.map = hoveredMarker.userData.defaultTexture;
                        hoveredMarker.material.needsUpdate = true;
                        hoveredMarker.scale.setScalar(1);
                        hoveredMarker = null;
                    }
                });
            }
        }
    }

    renderer.domElement.addEventListener('mousedown', (event) => {
        isMouseDown = true;
        isDragging = false;
        previousMousePosition = {
            x: event.offsetX,
            y: event.offsetY
        };
        renderer.domElement.style.cursor = 'grabbing';
    });

    renderer.domElement.addEventListener('mousemove', (event) => {
        if (!isMouseDown) return;

        const deltaMove = {
            x: event.offsetX - previousMousePosition.x,
            y: event.offsetY - previousMousePosition.y
        };

        if (Math.abs(deltaMove.x) > 3 || Math.abs(deltaMove.y) > 3) {
            isDragging = true;
        }

        if (isDragging) {
            rotationVelocity = {
                x: deltaMove.y * ROTATION_SPEED,
                y: deltaMove.x * ROTATION_SPEED
            };

            targetRotation = {
                x: globe.rotation.x + rotationVelocity.x,
                y: globe.rotation.y + rotationVelocity.y
            };
        }

        previousMousePosition = {
            x: event.offsetX,
            y: event.offsetY
        };
    });

    renderer.domElement.addEventListener('mouseup', (event) => {
        renderer.domElement.style.cursor = 'grab';
        if (!isDragging) {
            handleClick(event);
        }
        isMouseDown = false;
        isDragging = false;
    });

    renderer.domElement.addEventListener('mouseleave', () => {
        isMouseDown = false;
        isDragging = false;
        hoverText.style.display = 'none';
        if (hoveredMarker) {
            hoveredMarker.material.map = hoveredMarker.userData.defaultTexture;
            hoveredMarker.material.needsUpdate = true;
            hoveredMarker.scale.setScalar(1);
            hoveredMarker = null;
        }
    });

    renderer.domElement.addEventListener('wheel', (event) => {
        event.preventDefault();
        const zoomDelta = event.deltaY * 0.001;
        targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom + zoomDelta * ZOOM_SPEED));
    }, { passive: false });

    function animate() {
        requestAnimationFrame(animate);

        if (!isMouseDown) {
            rotationVelocity.x *= DAMPING;
            rotationVelocity.y *= DAMPING;

            targetRotation.x += rotationVelocity.x;
            targetRotation.y += rotationVelocity.y;
        }

        globe.rotation.x += (targetRotation.x - globe.rotation.x) * INERTIA;
        globe.rotation.y += (targetRotation.y - globe.rotation.y) * INERTIA;

        currentZoom += (targetZoom - currentZoom) * ZOOM_SMOOTHING;
        camera.position.z = currentZoom;

        renderer.render(scene, camera);
    }

    function resizeHandler() {
        const width = window.innerWidth * 0.9;
        const height = window.innerHeight * 0.7;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }

    function cleanup() {
        document.body.removeChild(hoverText);
    }

    return {
        renderer,
        animate,
        resizeHandler,
        cleanup,
        getMarkerObjects: () => markerObjects,
        updateMarkersForSearch,
        resetAllMarkers,
        filterMarkersByKeyword
    };
}
const projects = [
    { 
        id: 1, 
        title: 'SLS WOW HOTEL APARTMENT', 
        abbr: 'SLS', 
        image: "./ICON/SLS.svg", // Updated path
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b6964d2f-924b-44d0-903d-f6a28fdab2fa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=3df265ea-93df-4cb5-812f-918de24560e4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2015, 
        client: 'WOW INVEST. LIMITED',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        hoverImage: "./hover/SLS.png",
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/df0dc95d-f747-4f2b-ae30-7ba50421d813',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/dc703231-65cf-4e88-a864-e390ea13297e',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality%2F2B.%20Branded%20Hotel%20Apartment%2FDrawing&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU0xTIFdPVyBIb3RlbCBBcGFydG1lbnQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        threeDLink: 'https://aedasme.egnyte.com/navigate/file/12d2d573-3fcb-4322-ad93-23950fccdedf',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        tags: [
            'HIGH-RISE',
            'AWARDED',
            'BUILT'
        ],
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ff6a656d-b0de-48cc-b510-2d6124a61fe1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
        description: {
            paragraph1: "The SLS Dubai Hotel and Residences emerges as an iconic landmark in the heart of Downtown Dubai, redefining luxury living and hospitality. With its striking 75-floor silhouette, the project stands as a testament to architectural innovation, offering a unique blend of design ingenuity and extraordinary experiences. The facade introduces a bold “honeycomb” structure, creating a dynamic visual rhythm that both captivates and intrigues while adding texture and depth to the tower’s form.",
            paragraph2: "The project’s design creates a sense of both openness and privacy, achieved through a carefully considered geometry. Each residential unit is rotated at 45-degree angles across four axes, allowing for undiluted, panoramic views of Dubai’s skyline while maintaining complete privacy. Glass-cornered living rooms, bedrooms, and bathrooms invite natural light, enhancing the connection to the surrounding urban landscape.",
            paragraph3: "The proposal delivers 946 carefully curated units, including 254 hotel rooms, 321 apartments, and 371 branded residences, offering a seamless fusion of hospitality and residential luxury.  SLS Dubai redefines modern living, celebrating a design narrative that combines sophistication, functionality, and a bold architectural identity. A landmark of elegance, it reshapes Dubai’s urban experience and sets a new benchmark for contemporary design."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=cf9ac38d-346b-4c55-97a2-e6bf94ffb890&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=0b09bed9-dcb4-473b-ae25-60495cd28674&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=bf67a79e-4fda-43db-9186-f77216b9e4af&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=ffd8d234-dba6-48a5-bed1-6bbe08f46897&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]

    },
    { 
        id: 2, 
        title: 'RADISSON BLU HOTEL APARTMENT', 
        abbr: 'RAD', 
        image: "./ICON/RAD.svg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6a92700b-869b-421d-b104-9f30d88488f6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=07554c31-c2b6-4fac-b65d-e5476b5b9d61&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2016, 
        client: 'AL REEM REAL ESTATE DEVELOPMENT EST',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        hoverImage: "./hover/RAD.png",
        tags: [
            'INTERIOR'
        ],
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e4d1ebef-5ef6-488b-8032-9d860ba10da5',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e2c9f501-ef4c-46d0-810c-ce9b80d4f317',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFkaXNzb24gQmx1IEhvdGVsIEFwYXJ0bWVudCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=984f3406-3ecd-478b-9fde-d44a05f862c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=1aaa817a-24b3-44db-b0e7-63cba5afdc93&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=5fca849d-65c2-4a93-a182-1909509488b4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=dd927d95-b41a-4dd4-a7d6-23b104b84edd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=fa60d4cb-a4d9-4575-a2a1-c3128259f2af&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]

    },
    { 
        id: 3, 
        title: 'W HOTEL (LMMS HOTEL EXTENSION)', 
        abbr: 'WMS', 
        image: "./ICON/W.svg",
        hoverImage: "./hover/WMS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7894ce44-5ab4-4be9-8db5-6c9f34131b02&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=7cdde790-237a-4be8-93e7-0c80b3b09493&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2017, 
        client: 'WASL',
        program: 'HOSPITALITY',
        typology: 'HOSPITALITY',  
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        tags: [
            'HIGH-RISE',
            'AWARDED',
            'BUILT'
        ],
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/0aca36be-3fa6-4355-8339-82172ac0f026',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/ff59c6e9-5da5-4560-96cd-8a2a2f322766',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTE1NUyBIb3RlbCBFeHRlbnNpb24iXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/70fdb2b2-6644-4ae6-bf76-e624eade326e',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a2b3206f-37d8-4589-939b-898362ec0dd7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=3fb85446-b10c-4154-b67e-91551b2d2fd0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=40695073-a66e-4b73-ad1b-b308899e08e1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=dfaf9674-a17b-48cc-ae6e-c83f2a8b8108&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=5467ae05-cf9b-467f-bb4d-31b399477c9e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 4, 
        title: 'CITY GATEWAYS & AL BATEEN BEACH', 
        abbr: 'CGA', 
        image: "./ICON/CGA.svg",
        hoverImage: "./hover/CGA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=9ddccb4a-8bf0-49d8-ac18-0434bc5212d8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=ee0b8503-cada-42d1-b602-03d9270d2bff&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2018, 
        client: 'MODON',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN', 
        location: 'ABU DHABI',
        scale: 'XL', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/navigate/file/9394a6ef-0cd6-4657-baa6-94e4c7ff979e',
        visualLink: 'https://aedasme.egnyte.com/navigate/file/611966b5-0420-4a5f-a598-089fc3c639a1',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8e8427d1-6334-423b-b3bb-8607792ca37b',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f19ad5da-7a1a-4d22-b1a2-8908a227901e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=4ed1cf84-65eb-484e-a490-14aa7e89b172&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=eb158bae-a2de-4e30-a873-6ba691fbc78f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=c05163cc-4d1d-42d7-89dc-1c12893e6984&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=64631a51-3a3a-41d0-aae1-46b092d7053c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=1d60f5a7-a0ea-438b-b15f-b65aedf551af&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 5, 
        title: 'SILVER BEACH', 
        abbr: 'SVB', 
        image: "./ICON/SVB.svg",
        hoverImage: "./hover/SVB.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=76310ef9-9995-4d0f-a1da-3ba406972810&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=8a44fdfb-9271-47a9-a9f6-1fc56bd1342b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2019, 
        client: 'NEOM',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN', 
        location: 'KSA, SAUDI ARABIA',
        scale: 'XL', 
        epoch: 'FUTURE', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a2ee6fcb-d2c4-4d40-9649-8f5c2fbfe487',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8d372f36-ec5c-4a3d-a79a-282f999540d7',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/3829cb85-701f-4bcc-9169-3c3156bb4576',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d40b4f87-169f-4eb6-902d-f690580c0d3d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=5481d31e-99f0-4d48-8b77-c33dc88a42a2&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a17b177d-07ff-4611-8bc1-c6f221878297&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=cee8b079-6d0f-48d7-94ef-731a9aa5d56f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=173a0110-d12c-430f-bb37-a2d81677de75&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3a231a0c-2f30-46e9-99d7-2cff92b9ad03&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 6, 
        title: 'RUA AL HARAM 2020', 
        abbr: 'RUH', 
        image: "./ICON/RUA.svg",
        hoverImage: "./hover/RUA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=1866152a-6a90-42ff-8862-73df144a1d70&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=0b78105d-3aef-45bb-9915-0c90c0665321&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2020, 
        client: 'PIF',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'XL', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/efdc2ace-9f9c-41eb-a770-e563772400c7',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4727b812-76b4-4c00-a7b1-37da20aa7bb3',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/0c5484bf-8f57-424f-ae56-73b5ba40c3ff',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=96c8dca5-489c-443c-a04d-7c25760d3f19&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "The project is located in one of the holiest sites in the world, Mecca, Saudi Arabia.  It aims to revive the city's heritage through extensive research. By studying historical descriptions, graphical representations, and old photographs, the proposal analyzes the traditional Makkan style, urban fabric, and the daily life of its people. This research led to the creation of a detailed catalog of Makkan buildings, houses, and unique architectural components such as doors, windows, and roshans, reinterpreted in a modern paradigm.",
            paragraph2: "Set on a challenging mountainous terrain, the proposal introduces \"Makkah’s Highline\", a continuous green pedestrian belt that connects the site to the second expansion’s skybridge. Covering 80,000 sqm of public realm, the highline prioritizes pedestrian movement and creates an inviting, car-free experience by relocating vehicular access underground.",
            paragraph3: "The masterplan is organized into five clusters, each distinguished by a unique character, and includes residential, hospitality, retail, office, and cultural spaces. Inspired by the organic arrangement of old Mecca’s urban fabric, the clusters reintroduce traditional public realm components while addressing contemporary urban needs. This vision celebrates Mecca’s heritage, creating a modern yet timeless destination for residents and visitors."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=48efad4c-9c5b-4f48-8ef0-b87f8fb9a351&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=6429b569-094e-4e76-b9e1-d32f8e8478ab&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=8e0ed4b3-2054-44fc-aada-689ff568adb6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=939fc3d4-5a99-48f3-9bd2-a4dad2855232&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=53de8ece-eb85-4b33-9fbb-c48883fe05f6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 7, 
        title: 'TROJENA SKI VILLAGE', 
        abbr: 'SKI', 
        image: "./ICON/SKI.svg",
        hoverImage: "./hover/SKI.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=98b3a94f-1eca-418e-8c4a-410881bbbbdf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=fb59c183-a144-43c9-9a8b-de1bda0d8240&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2021, 
        client: 'NEOM',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'FUTURE', 
        tags: [
            'AWARDED'
        ],
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/92567bc4-8f2c-41ad-9c0b-30f85dd885d2',
        visualLink: 'https://aedasme.egnyte.com/navigate/file/25b950a0-5aab-4b36-88d4-cbc424afb93a',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiVHJvamVuYSBTa2kgVmlsbGFnZSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/48beb068-37f2-4471-92ad-a054f40823f8',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d8827888-1bf6-48c1-b465-51c5be93ed4b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=1d113893-8281-43d2-961d-06ecfb8bcdf1&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=aed83d29-d36d-42d1-812d-3dfa74d9886e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=035f8cd7-f310-4d8c-b56a-916413f7df47&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3896a67f-953c-4647-9a1a-7dd209eb1979&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=b0178749-1db0-46ab-9837-d540573cb74a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 8, 
        title: 'MINA ZAYED', 
        abbr: 'MNZ', 
        image: "./ICON/MNZ.svg",
        hoverImage: "./hover/MNZ.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2fceb334-d42f-4ea4-ac52-515d18e8341d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=c80019c1-bfac-4109-b4dc-bf36a0d89c82&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2022, 
        client: 'ALDAR',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'ABU DHABI',
        scale: 'XL', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e8c40ef4-3933-435c-a549-20c03210e9cb',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/78984ef1-f128-4fc4-9ac3-efdce60f41a5',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f9f1878c-9865-4a16-bc74-0f9035c8e155&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=4c56f5a9-aa03-4e7b-967a-697ebcbb81dc&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=c885916b-9b3b-4bc0-ab23-73089395a670&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=02308a32-bd95-4892-a3c9-053126e83c31&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=ce8048f2-aa9c-4208-9348-4cb99d0da03b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=0300225c-ce2e-4926-bcf7-d36387bfb688&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3fe1c75d-3066-4412-8798-b7bb16976187&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 9, 
        title: 'PROJECT ELEPHANT', 
        abbr: 'ELP', 
        image: "./ICON/ELP.svg",
        hoverImage: "./hover/ELP.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=40886ea5-bda5-4448-8cd9-a8eeb4c50bab&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=7d40b31f-99d7-49e9-a68e-0a17907cbd36&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2023, 
        client: 'PIF',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8c5deed0-ec71-4d7a-a666-4cc4b5ce9526',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/b07701f0-69b3-4cfe-bc95-561b5ab815ce',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUHJvamVjdCBFbGVwaGFudCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ddd5539b-579d-4b8d-91b2-e6541c67739c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "The Project seeks to revive the lost Erum civilization, also known as \"Erum of the Pillars,\" which has long captivated the minds of archaeologists, academics, and writers. To capitalize on this fascination, the project envisions a unique, large-scale resort in Saudi Arabia's Empty Quarter Desert that provides visitors with an authentic experience of the legendary civilization that flourished thousands of years ago.",
            paragraph2: "With 1,210 keys, the resort caters to the mass market while ensuring financial viability. The location spans 546,000 square meters, designed to adapt to the environment and operate seasonally.",
            paragraph3: "The competition comprised two phases, and the team submitted five distinct ideas and a narrative in response to the brief, complete with massing, visual frameworks, and open-space layouts. The team presented five captivating tales based on the ideas of constellations, meteors, pillars, canyons, and wells, each representing different periods of evolution, such as the ice age, meteor impacts, great floods, younger dryers, and climate change, significant milestones in the formation of great civilizations. The objective is to propose a unique set of design alternatives that embody the desire to construct an authentic community loyal to Erum's history and legend, showcasing the fabled civilization and inspiring visitors' admiration for the architecture."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=a9efe80f-fbb8-44af-94c4-8737c541e9e8&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=d7e6fe15-1643-4e9c-8e34-882f07f8d482&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=c63f3133-80f1-4be3-8295-69a296044510&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=aba13775-a9b5-4e09-8920-44aec30c3b6e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=52ebbd42-6db5-4c96-90d8-2b132955f0ec&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 10, 
        title: 'MODON CALA IRIS ', 
        abbr: 'MOR', 
        image: "./ICON/MOR.svg",
        hoverImage: "./hover/MOR.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c9bdad2f-b266-4834-af53-5bd383057e19&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=60070b0d-e6c6-4c7d-8669-20a42ac6bd39&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2024, 
        client: 'MODON PROPERTIES',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'MOROCCO',
        scale: 'XL', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/f73613da-9d5f-4abf-bfb2-1cdd984aea64',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/52147e24-8515-4105-85e4-f6bd67fbc7b5',
        animationLink: 'https://aedasme.egnyte.com/navigate/file/d9933f9c-2c79-47fc-92e3-e3436315c793',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7721f355-e944-412b-be79-bc7b266e145a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=401f307f-35a8-4cb9-9290-e221a09830cc&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=14bfb658-a823-4dc4-a3d7-eca1f39ef987&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=88291ab8-3e5b-4848-9a40-a9f7c6542d52&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=859d3893-9f1e-466a-b8a6-2ddd960a507d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=7c82dcea-1377-447a-a695-4478f0709aa8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=9c139c98-4f46-4590-b502-3497362d2d10&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 11, 
        title: 'JEBEL ALI VILLAGE P2', 
        abbr: 'JA2', 
        image: "./ICON/JA2.svg",
        hoverImage: "./hover/JA2.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2f1ab495-83b0-4871-ab42-ed854f2d9f47&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=497f40c7-f80e-4d72-bd20-5bf5997380b0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2016, 
        client: 'WASL',
        program: 'RESIDENTIAL', 
        typology: 'RESIDENTIAL', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/06ed9c99-68c2-43e6-8e45-f97cbb9eadb2',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/de6dc567-a442-4e3a-8406-eb7b2cbfb4ef',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSmViZWwgQWxpIFZpbGxhZ2UgUDIiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/7a25a4ad-6dae-4953-8e89-d6ec329b707b',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=5b4a0885-a329-4369-a931-965bddb1bbfd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Located within the Jebel Ali Village Master Plan, the Hillside Apartments propose a distinctive residential experience that harmonizes suburban tranquility with urban vibrancy. The Jebel Ali Village (JAV) mixed use development is set to become a major new destination in Dubai consisting of residential communities; a commercial business hub focused on innovation; hotels; entertainment; retail and community facilities. At the heart of the JAV development is a central park and boulevard that ensure a 24/7 lifestyle and vigor. It also features a central space for concerts, sports events, films etc.",
            paragraph2: "Hillside Apartments introduces a tranquil, hillside-inspired residential offering in Dubai. The apartments are set within a thoughtfully planned landscape that prioritizes pedestrian-friendly streets, green spaces, and a suburban character, offering a peaceful escape from the city’s bustle while remaining connected to key urban nodes. The project embraces a modern and contemporary architectural style, enriched with traditional materials that reflect Dubai’s cultural heritage.",
            paragraph3: "Setting a benchmark for modern residential living, the proposal brings together nature, tradition, and innovation to create a harmonious and connected community."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=7a980849-345d-4e27-ae8e-f7c2c94b07d3&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=de9166b7-efb9-4437-b90d-57d32a7db710&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=75166aa9-393a-4cad-9605-5806731704a4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3636893f-de17-4f3c-bd85-04554ac15402&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=b8b5c93f-d5e0-43c8-bb50-937d89c8041d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 12, 
        title: 'EMAAR VIDA HOTEL', 
        abbr: 'VDA', 
        image: "./ICON/VDA.svg",
        hoverImage: "./hover/VDA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ccab3421-de6d-415c-bc66-f7d9af580fe2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=0abd29c9-88cd-4d3d-9917-b96eca0ee9b4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2016, 
        client: 'EMAAR PROPERTIES',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        tags: [
            'HIGH-RISE'
        ],
        presentationLink: 'https://aedasme.egnyte.com/navigate/file/34b8bb38-c287-49c5-b2bf-f34aabfcb97b',
        visualLink: 'https://aedasme.egnyte.com/navigate/file/8324ab30-69be-48ea-9984-763c1ac7e73b',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality%2F2B.%20Branded%20Hotel%20Apartment%2FDrawing&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRW1hYXIgVmlkYSBIb3RlbCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRW1hYXIgVmlkYSBIb3RlbCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=cee7c481-d5fa-4cf2-a75b-fe9e231b0636&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=d9135396-f72d-47b2-a1bf-4b8ee09641ad&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=23c54637-597a-4bd9-9b29-40edd59e6862&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=b0e878c9-4c63-4fbd-9606-24c2dedfbdcb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=9989c04a-67b8-46ee-9bee-39152bdf5aa2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 13, 
        title: 'GOLF VILLAS', 
        abbr: 'GOLF', 
        image: "./ICON/GFV.svg",
        hoverImage: "./hover/GOLF.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a3cc079e-6020-4e2a-83df-90f53b35ac20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=7573d7e5-6acf-4b89-9521-40fe9675633d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2017, 
        client: 'EMAAR PROPERTIES',
        program: 'RESIDENTIAL',
        typology: 'RESIDENTIAL',  
        location: 'DUBAI, UAE',
        scale: 'S', 
        epoch: 'PRESENT', 
        tags: [
            'INTERIOR'
        ],
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/17290a5a-fbd5-4dfd-baa8-cf339353236a',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/37c048d7-4bee-4f1c-97ee-456c510e8138',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR29sZiBWaWxsYXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR29sZiBWaWxsYXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d908b598-0188-425b-bbbc-7d2d5f77ee8c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=faab3423-860f-4639-b78b-d44a2f479e4d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=975bded3-46a0-40e0-84b2-a1a15cb84988&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=57eee44f-9e87-4af2-b826-ed2fa22d1de3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=5c89ab2f-c41a-4bdb-a007-74e67499c34f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 14, 
        title: 'SIDRA III VILLAS', 
        abbr: 'SID', 
        image: "./ICON/SID.svg",
        hoverImage: "./hover/SID.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=1e5e63f2-5fd9-4f83-ab07-22f7a1ecb35f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=01e3b231-a535-4deb-8443-52c46c867542&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2017, 
        client: 'EMAAR PROPERTIES',
        program: 'RESIDENTIAL', 
        typology: 'RESIDENTIAL', 
        location: 'DUBAI, UAE',
        scale: 'S', 
        epoch: 'PRESENT', 
        tags: [
            'INTERIOR'
        ],
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/d52520ab-68f9-4baa-ba66-b3d2d30509ef',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU2lkcmEgSUlJIFZpbGxhcyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        linkImages: {
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ac47b403-3504-4cc3-a411-e010e7bb192a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=0b3c7919-54ad-4104-bbc2-b8e306c736e1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=6ee4f57a-960d-49c7-acb3-8f536d701317&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 15, 
        title: 'ENOC FUTURISTIC RETAIL', 
        abbr: 'ENC', 
        image: "./ICON/ENC.png",
        hoverImage: "./hover/ENC.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=277c2ef0-929c-49e7-9dcc-9551828f1d85&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=84be6e0a-c121-4158-abb9-6a69847780ba&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2018, 
        client: 'ENOC',
        program: 'TRANSPORTATION',
        typology: 'TRANSPORTATION',  
        location: 'DUBAI, UAE',
        scale: 'S', 
        epoch: 'FUTURE', 
        tags: [
            'AWARDED',
             'BUILT'       
             ],
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/63d790a6-2d7d-43d8-8e77-0dec247129d2',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2da58865-3a61-4f8f-9750-f6b93b022fc9',
        animationLink: 'https://aedasme.egnyte.com/navigate/file/0d056640-259d-4330-ad9a-6d3e9deeb795',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRU5PQyBGdXR1cmlzdGljIFJldGFpbCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=e055444a-c034-4a0d-95ed-67f2493dc019&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "The ENOC Future Station redefines the fuel experience by fusing the UAE’s cultural heritage with sustainable innovation. Drawing inspiration from the Ghaf tree, the design echoes its symbolic roots of resilience, shelter, and permanence, creating a space that bridges the past and the future. The station’s architecture honors the Ghaf’s legacy as a source of refuge for travelers, while embracing a forward-looking vision for sustainability and functionality.",
            paragraph2: "At the heart of the design is a striking Ghaf-shaped canopy, crafted from lightweight, eco-friendly carbon fiber and featuring a UV-protected, corrosion-proof cushion layer. This canopy is more than a functional structure; it represents a harmony between cultural heritage and cutting-edge technology. It houses 283 solar photovoltaic panels and an innovative 25-meter wind turbine, generating renewable energy to power the station. These features align with the client’s vision of energy efficiency, making the station a testament to the possibilities of sustainable design.",
            paragraph3: "As the first fuel station in the world to achieve LEED Platinum certification, the ENOC Future Station sets a global precedent. Its integration of sustainable technologies and cultural references makes it more than a service station—it is a symbol of how tradition and innovation can work hand in hand to pioneer a new future."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=4aeb8a21-511a-442d-b24b-248d08e8922b&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a49d9b79-c8aa-41b9-8b63-82cbd0458185&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a78e4625-7921-4b32-bbff-c2ae59180f13&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=71ff0ac4-7d68-48ac-b52a-09b4d26e01a5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 16, 
        title: 'YAS MEDICAL STREET', 
        abbr: 'MED', 
        image: "./ICON/MED.svg",
        hoverImage: "./hover/MED.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7a02a260-ff44-4e7f-b103-cce302af104e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=217f28bf-2510-4efb-ac6f-9073499e115a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2018, 
        client: 'MODON',
        program: 'OTHERS',
        typology: 'MEDICAL STREET',  
        location: 'ABU DHABI',
        scale: 'L', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8780aa5a-153f-4b80-be30-dc467cf560df',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/46738a81-a31a-4402-90a1-11532b0e6c17',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4b4f49e8-2bd9-4389-afe0-bc328640ed62',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=5584521c-ec60-4ed4-87c8-9cc35a05b9b7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=382dd6f9-eba0-4f7c-863d-67f1cee0f9b0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=6a7edff8-88f6-49a2-8bed-e34cdc40f8d0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=189fa003-5e53-4d52-9220-382928091a10&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=470fe44a-21db-4628-9cc8-c523f1b08131&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 17, 
        title: 'NEOM BAY MANSIONS CMP', 
        abbr: 'NBY', 
        image: "./ICON/NBY.svg",
        hoverImage: "./hover/NBY.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=8215a838-d512-42b1-8969-d6b419e10c44&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=e1f64ee0-ffce-43f8-8591-21999050cd0e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2019, 
        client: 'NEOM',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'XL', 
        epoch: 'FUTURE', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/de2e97b3-edfa-4d88-b380-8e6c05e937af',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a0308775-b9b7-463b-85a8-203d1c7f9daa',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/07fdf512-10f9-4f8c-9c1d-1d17cf6b77c7',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b2dee9cc-ad11-429d-9c95-e201f5eeb75d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "NEOM Bay sets a new vision for luxury living, reconnecting architecture with nature and the unique rhythms of the landscape. Guided by the principles of \"Biohacking Urbanism,\" the masterplan integrates organic wadi networks, linking coastal communities to The Line while structuring urban growth sustainably. This seamless connection activates NEOM Bay as a year-round destination, offering mobility, leisure, and cultural opportunities in a pristine environment.",
            paragraph2: "At the heart of the development, NEOM Bay Village combines cultural heritage with modern design, inspired by traditional settlements but enhanced with climate-controlled public spaces and cutting-edge technology. Meanwhile, the Marina District is centered around the NEOM HQ Complex, a coral reef-inspired mixed-use landmark with luxury apartments, hotels, retail, and community spaces",
            paragraph3: "From exclusive island resorts to botanical garden hotels, NEOM Bay offers unparalleled hospitality experiences. The residential offerings include luxury mansions and gated mega-mansion enclaves, blending innovative design with privacy and exclusivity. NEOM Bay is where the world's elite come to live in harmony with nature while experiencing futuristic urban living."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=9ff320b1-30d8-4f7b-b4ef-fe202bccfc46&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=ceba6c6d-fbe9-4352-bca7-fdd79bd108b1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=1c335a17-0c41-4bab-a3a6-640617d21660&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=dc14967a-21ca-48b2-9d38-c04c31c6b120&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=faab77b5-7d08-49f0-9db3-48ccd5b67b29&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 18, 
        title: 'D3 OFFICE', 
        abbr: 'D3O', 
        image: "./ICON/D3O.svg",
        hoverImage: "./hover/D3O.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=9ed03bc4-0f39-4ce8-9fcc-389645a1aba1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=5716a804-1a23-42cd-9ca5-875a6a192076&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2019, 
        client: 'TECOM GROUP',
        program: 'OFFICE', 
        typology: 'OFFICE',  
        location: 'DUBAI,UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/bf117226-a817-4f8b-b362-c9a097d05a80',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F3.%20Office&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRDMgT2ZmaWNlcyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/924d9f8c-4c7d-495c-af15-6d77f105404a',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8d94c17b-0f90-4fd6-aa12-3dfc9fdab299',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=852c1ef0-8b14-4346-bf0d-db4dc9b15fdb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=8947c966-7157-4a01-b7cb-16f5e76124f8&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=bd1ede03-6542-4536-a644-497662563841&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=e8eefd6c-19be-48ca-b1b2-34a2b72b9193&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=47985d95-6738-47bf-b4e5-0196ec9686c0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=1a92ae10-0372-4402-bbca-91f3e6dcc281&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 19, 
        title: 'HABITAS AL-ULA', 
        abbr: 'HAB', 
        image: "./ICON/HAB.svg",
        hoverImage: "./hover/HAB.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=67123175-567e-40d2-9b31-12b3ac7dcd61&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=00036b1d-d9be-469e-98ee-99601b921c95&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2020, 
        client: 'ROYAL COMMISSION FOR AL-ULA',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'M', 
        epoch: 'PRESENT', 
        tags: [
            'AWARDED',
            'BUILT'
        ],
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/6c6def1c-a686-46bd-8fd4-81314cc7f046',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSGFiaXRhcyBBbC1VbGEiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c099f89c-2573-4fd1-83a8-6c4fb6c0f001',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSGFiaXRhcyBBbC1VbGEiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=cfd17305-1860-482c-b454-99db7c559ece&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=84c1975f-78f8-4c5e-b85c-4da3cfc35a94&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a148aa2c-ea2d-4b6a-b601-f1f86b87a153&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=8cc8979d-8969-45a3-81e9-62200764e856&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=1ff83d19-ed48-46c0-bca0-30623d28dc20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=33e0ca6e-38d6-4f09-b80e-3b73ea4c7530&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 20, 
        title: 'ADQ HEADQUARTERS', 
        abbr: 'ADQ', 
        image: "./ICON/ADQ.svg",
        hoverImage: "./hover/ADQ.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ffaa830e-1669-4716-8a4a-71a299fb48c9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=4c6b7144-8bef-4d2f-88f7-c7a3d5e67546&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2020, 
        client: 'MODON',
        program: 'OFFICE', 
        typology: 'OFFICE',  
        location: 'ABU DHABI',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/e499625d-1b61-4e3b-9203-bebc547227bd',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQURRIEhlYWRxdWFydGVycyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/11512cb1-ed19-43ee-a100-3f16c0799f97',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/70f396cf-5248-402c-a6a7-89ddce0c1b7b',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/5167fd71-351d-4ba1-8202-6ec8b40681e8',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=e1afb5b4-bd13-4729-a32b-c71cf8b4e028&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=58497289-a597-416e-b793-03b86daee0d1&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=d22a44b1-6800-4ee7-ab66-6ecc7b75d582&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=2e2877c4-4286-44aa-b99c-00d445724112&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=2a01d626-b5de-4a17-ac6a-3adf6ff8b899&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=bb2f6f0a-8c5a-492b-86b3-27f22fca0819&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 21, 
        title: 'WADI SAFAR OBEROI', 
        abbr: 'WDS', 
        image: "/ICON/WDS.svg",
        hoverImage: "./hover/WDS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=12db4279-9e1f-4af7-b190-c41a24be3c6f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=72d1fe11-3f69-4196-8746-e99abcf5a7c5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2021, 
        client: 'DGCL',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/6c9bc759-b082-4ead-b143-712e50ab6748',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBXYWRpIFNhZmFyIE9iZXJvaSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2d8772ee-a401-4938-85eb-138f5259a6e3',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBXYWRpIFNhZmFyIE9iZXJvaSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c0509431-0e28-40b7-aec0-6f8b987d0c43&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=9944b61c-4b6e-4917-a777-5089080e63fa&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=53483c75-fe9c-40d3-aedc-61d4639c1283&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=81bab909-db49-4e0f-8c9b-11e99b06030c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=cb59b7cb-41d9-4c79-9fd4-c0811eff901d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=daf0e420-7a99-47a5-b3f7-6a77e238825b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 22, 
        title: 'DGCL KING SALMAN SQUARE', 
        abbr: 'KSS', 
        image: "/ICON/KSS.svg",
        hoverImage: "./hover/KSS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=4f92b890-318c-4b4d-a078-685605ca5281&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=3e87037d-172f-4c82-97cc-5dcd1cfebed5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2021, 
        client: 'DGCL',
        program: 'OTHERS', 
        typology: 'F&B',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/DGCL%20King%20Salman%20Square/Presentation',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdDTCBLaW5nIFNhbG1hbiBTcXVhcmUiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/11d9e1cf-3587-44ab-a9de-ab4a84838d0d',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdDTCBLaW5nIFNhbG1hbiBTcXVhcmUiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=92f00e77-e954-40db-a640-99420b608719&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=ac7c937a-dfd9-4669-ae81-8b08903843cd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=75be7652-8c28-4145-9496-469dc1b47b9f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=44fec4c6-5222-4d15-877b-1e70c521119e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=b3da0aae-3a81-4713-8bba-5c7d82b4ed9f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"        ]
    },
    { 
        id: 23, 
        title: 'THE POINTE DISTRICT', 
        abbr: 'PNT', 
        image: "/ICON/PNT.svg",
        hoverImage: "./hover/PNT.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7f25fdb4-7944-4f92-9bc9-58b3d7208abf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=a454a7dc-b61b-4304-8959-ce2899c00b79&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2022, 
        client: 'NAKHEEL',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN',  
        location: 'DUBAI, UAE',
        scale: 'XL', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/573aeae0-b896-4b10-85dc-a7e73d113c5e',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/d818065b-d0e4-4ce2-a84e-d1a5f10eb80e',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/de1ffd02-f5c4-40bd-835c-318d028c49a5',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a50c7014-1991-4400-8784-0571b2c1590d',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiVGhlIFBvaW50ZSBEaXN0cmljdCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=358e7509-9e7b-4e6a-80b6-b48888316ccc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Located on the Pointe, Palm Jumeirah, the masterplan reimagines a waterfront destination, where luxury, nature, and architecture converge to define an iconic lifestyle. Inspired by the organic forms of nature, the proposal creates an interconnected network of landscaped spaces that seamlessly flow towards the water frontage. This integration transforms the masterplan into a cohesive canvas of tranquillity and elegance.",
            paragraph2: "The focal point of the project is an ultra-exclusive beach club, crowned by a sculptural shading structure. Surrounding it are ultra-luxury hotels, premium residences, and a high-end retail district, offering world-class amenities and exceptional views. The spatial geometry ensures valuable frontage for every plot, while open spaces foster wellbeing and provide a dynamic connection to the sea.",
            paragraph3: "By drawing inspiration from global luxury benchmarks, the proposal elevates Palm Jumeirah to a new echelon of elegance. A symphony of open spaces, iconic architecture, and premium offerings ensures the masterplan is not just a development but a living experience—one that captures the essence of refined waterfront living for residents and visitors alike."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=78a67749-1f55-4efd-b595-50471908555e&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=6e6f4aee-11c0-4bdf-81a7-cab90eed023b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=92cb787d-3e53-42af-9807-264780feb7f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3b2fce39-fcd9-4e5b-9a46-7854b341e8ad&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=d75e844f-d7de-4e16-8e44-fbbe608d6049&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 24, 
        title: 'D3 RESIDENTIAL', 
        abbr: 'D3R', 
        image: "/ICON/D3R.svg",
        hoverImage: "./hover/D3R.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=fbb6ea8d-5c30-4159-8c7f-5201d680af2a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=cf8586a5-45c9-4660-a44b-ba79dc08ceb4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2022, 
        client: 'TECOM GROUP',
        program: 'RESIDENTIAL', 
        typology: 'RESIDENTIAL',  
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        tags: [
            'HIGH-RISE'
        ],
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/905a3def-d48d-474c-bd9f-2796977f58de',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRDMgUmVzaWRlbnRpYWwiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/f4d280e4-c184-4c9f-b028-f45f46d281df',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2328a3f8-4bc1-48ee-8ef8-9fffe352cc78',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=3665acbe-b261-41ef-8d9f-93d8bd3d2f14&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Located in the heart of D3, the project redefines urban living for designers, artists, and creative thinkers, offering a unique \"live, work, play\" lifestyle. The design responds to the neighboring D3 Offices in Phase 1 in terms of massing, scale, and materiality, creating a continuous architectural dialogue.",
            paragraph2: "The residential development features a mix of apartments, duplexes and penthouses, curated to enhance the tenant experience. A dynamic podium level connects the two buildings, serving as a vibrant hub for residents with curated spaces such as a co-working zone, outdoor gym, pool, barbecue areas, and children’s activities.",
            paragraph3: "With dual-aspect units offering panoramic views of the Burj Khalifa and the Dubai Canal, the project takes full advantage of its prime location. This creative hub is not just a residential space but a cultural hub where design and innovation thrive, fostering a community of forward-thinking residents who shape the city's creative future."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=ed9bf1b4-0416-4c6b-9749-95b538843daf&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=37f940a9-8b90-4508-9908-40bcaaae8b18&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=8320d2b2-91ac-4b1d-bd63-0f6ac3042609&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=71c74601-ffcb-4b66-918e-658ea697d9bd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=655e6b7d-a41a-4997-8d2f-5601c15ad713&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 25, 
        title: 'DGII LANGHAM', 
        abbr: 'LGH', 
        image: "/ICON/LGH.svg",
        hoverImage: "./hover/LGH.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f212ccf5-5eb5-43dc-a847-56ec73afd6c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=58d2abed-a7af-455c-99ad-0a82fdc99579&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2023, 
        client: 'DGCL',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/43dbaf34-4cae-497c-8adc-1f968832d481',
        drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdJSSBMYW5naGFtIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIkRyYXdpbmciXX1d',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e7f1e7c1-0aee-4e7d-acc7-3db2aabbfcb0',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/10799131-7759-4a4e-bf98-423f5e83c27d',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6a3c7c37-a695-4e7f-9fc9-03da8a0b1e67&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "With direct access to the Grand Boulevard Anchor, the Hotel provides stunning views of the Opera and Wadi Hanifa. Nestled close to the At Turaif UNESCO World Heritage Site, the development spans 22,000 sqm of GFA and includes a 200-key hotel, a club, a culinary school, a rooftop pool deck, and a signature restaurant.",
            paragraph2: "The architectural concept emphasizes a duality between formal and organic design elements. The Boulevard-facing façade mirrors the discipline of French urban design, while the plaza-facing façade adopts a natural, wadi-inspired form. The expanded plaza creates an elevated experience, framing the Opera as the centrepiece and cascading into an Urban Amphitheatre, where the hotel rooms provide the best seats for this theatrical arrangement.",
            paragraph3: "Terraces enriched with over 15 species of local vegetation, sophisticated detailing, and natural materials add depth to the room experience. The inclusion of a vertical garden redefines urban living by offering tranquillity, privacy, and a unique connection to the surrounding environment, ensuring guests feel both at peace and immersed in the city's essence."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=018feeb7-0fc0-40fd-af97-20aa1a19163b&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=cc5025be-c8c5-486b-9f53-b8cc4fafa764&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=7c043125-698a-49c0-9c48-4a3ef5e9b99e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=1876520a-860c-4df5-be23-c37b80987344&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 26, 
        title: 'DIFC PA07A OFFICE BUILDING', 
        abbr: 'FCO', 
        image: "./ICON/FCO.svg",
        hoverImage: "./hover/FCO.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b0e85e3f-768c-4bfa-a77f-ccf5400bef0c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=bcff6053-b422-4f76-a1d3-9575a6dc932b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2023, 
        client: 'DIFC',
        program: 'OFFICE', 
        typology: 'OFFICE',  
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/ce2e56d8-5b24-42f4-bb68-1b5bca525d14',
        visualLink: 'https://aedasme.egnyte.com/navigate/file/86c44e5e-4d7b-4291-9258-fa8262c64f03',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=79bc6026-a8b2-4c00-bbdc-fdd1a5bb822c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "The DIFC Office Tower is a transformative addition to Dubai’s financial district, combining luxury, work, and leisure in a single architectural statement. Its defining V-cut design creates striking symmetry and dynamic stepped terraces that cascade toward the city, framing panoramic views of Gate Avenue and Dubai’s skyline. The tower integrates natural landscapes into its vertical form, with the V-cut terraces blending greenery into the structure while maintaining a clean, bold form.",
            paragraph2: "At the top, the luxurious rooftop club provides an elevated leisure experience, offering stunning views and exclusive amenities. The stepped design of the club’s crown enhances the visual elegance of the tower, revealing intricate terraces that merge nature and urban sophistication. The podium, comprising five floors of F&B spaces includes outdoor seating areas surrounded by greenery that encourage relaxation and social interaction.",
            paragraph3: "Anchored by a grand triple-height lobby and landscaped forecourt, the Immersive Tower creates a strong connection to its urban surroundings. The project prioritizes openness, with inviting spaces that integrate seamlessly with the street, creating dialogue between architecture and community"
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=5f60c1ec-3bfc-48cf-bd78-679f449b10ee&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=8701b52e-9503-4ea3-8b2b-1f99e5893813&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=38c42dc2-acf1-4655-86ef-3faa0dd11471&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a60822cd-d553-441f-86d4-70262948b080&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 27, 
        title: 'DGCL CEC', 
        abbr: 'CEC', 
        image: "./ICON/CEC.svg",
        hoverImage: "./hover/CEC.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7314d9ce-1601-4450-b5f0-f28fd6c0d0c9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=4759f11d-61cb-4783-85fd-9beb7dba005f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2024, 
        client: 'DIFC',
        program: 'OTHERS', 
        typology: 'CONFERENCE CENTER',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'PAST', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/636486d2-a23a-4b5c-8737-26f27646261d',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/b81f1d77-78fa-45a6-83ce-16be9dde3567',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/eb64ec72-c18a-4197-bab7-e5f5e1ac0b77',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'

        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f4db67c1-4697-4981-a5eb-4e5ddcfd36d6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=f5afab7d-b744-43fe-a985-527a3cd91172&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=2044d487-9113-442d-8024-1dbd0dbb2531&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=7d035257-3f31-4d7b-95be-47b5d872f463&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=dd82e727-3d10-4ada-878c-5fbfe89ea731&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=faf9190f-d083-43a1-8a5e-3e3b17993f6c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },

    { 
        id: 28, 
        title: 'WASL CORE STADIUM', 
        abbr: 'STA', 
        image: "./ICON/STA.svg",
        hoverImage: "./hover/STA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=543961a4-bab9-4a8c-9833-0fbfb6100dc0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=edf5f8ad-09a9-4e32-8974-9fa027014011&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2024, 
        client: 'DIFC',
        program: 'OTHERS', 
        typology: 'STADIUM',  
        location: 'DUABI, UAE',
        scale: 'M', 
        epoch: 'FUTURE', 
        presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/d2203605-d0fc-4640-bcc5-a3a0d7212aed',
        visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/80032dfc-1bfe-40ea-af68-1ab46ef12ce0',
        animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4dbb3b25-7afe-4186-a7c4-c56d483e743f',
        threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/68b04a2e-a039-4b5a-b645-0da2b1af8e04',
        linkImages: {
            presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
            threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'

        },
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=571c862e-242e-4844-9d01-8fccd175ec81&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "The proposed project reimagines the future of sports facilities in Dubai, addressing the underutilization of conventional stadiums, which often remain empty and operate at limited capacity. Designed as a multi-sport, multi-purpose venue, the project introduces an adaptable stadium that maximizes usage throughout the year.",
            paragraph2: "The design takes on a radial configuration, symbolizing resilience, strength, and endurance. The form evokes the energy of a vortex—dynamic, ever-changing, and alive with activity. This vision is further amplified by its integration of greenery, creating a vortex of both adrenaline and nature.",
            paragraph3: "The program extends beyond sports, offering outdoor facilities, extreme games arenas, retail spaces, residential components, and community areas, ensuring the space remains a vibrant hub for recreation, entertainment, and living. A defining feature of the design is the iconic roof, an architectural statement that unifies the space while providing shade and enhancing functionality.",
            paragraph4: "This proposal not only addresses the evolving needs of sports infrastructure but also positions itself as a sustainable, year-round destination—a testament to Dubai’s innovative spirit and ambition to redefine urban experiences."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=69fc187f-d0ea-40ff-881b-a30cc1e4a1cc&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=97d630fc-2a9c-4571-9bf0-dd39aa5aa2d4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=fee049a4-cfb6-48f7-97b4-32207aec7509&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=251a98b6-f4c2-48ba-bfa9-84765f95a534&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 29, 
        title: ' HUDARIYAT VILLAS', 
        abbr: 'HDV', 
        image: "./ICON/HDV.svg",
       coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c38534dc-2fcb-4e9b-8d6d-c9cd82ec3d17&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=963352ee-3ef0-4420-80ac-61f34b6cdcde&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2023, 
        client: 'MODON',
        program: 'RESIDENTIAL', 
        typology: ' RESIDENTIAL',
        location: 'ABU DHABI',
        scale: 'S', 
        epoch: 'PRESENT', 
       hoverImage: "./hover/HDV.png",
       presentationLink: 'https://aedasme.egnyte.com/navigate/file/023dc94d-7a99-46d0-be3b-7ccbe8721624',
  
       visualLink: 'https://aedasme.egnyte.com/navigate/folder/70cf89b0-d8ee-4ab9-ab20-e39e363975d2',
       drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTW9kb24gSHVkYXlyaXlhdCBWaWxsYXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
       threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F1.%20Residential%2F1B.%20Villa%2FModel&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTW9kb24gSHVkYXlyaXlhdCBWaWxsYXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
       linkImages: {
           presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
           visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
           drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
           threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
        },
        // New fields for the description section
       descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=cdf6af92-6062-4c2f-bfd7-99eb3ed0636b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
       description: {
           paragraph1: "Hudayriyat Residences reimagines resort-style living with a focus on architectural quality and coastal sustainability, drawing inspiration from some of the world’s most iconic seaside developments. The development comprises of three distinct communities—Hudayriyat Quays, Hudayriyat Hills, and Hudayriyat Coast, each with a unique character.",
           paragraph2: "Hudayriyat Quays Villas offer an exclusive waterfront lifestyle, featuring private mansions and villas with direct water access. Thoughtfully positioned second-row villas benefit from proximity to the waterfront while maintaining privacy. The Marina serves as a vibrant social hub, making this district the only water’s edge villa community on the northern side of Hudayriyat Central. With contemporary, clean design elements, the architectural language emphasizes crisp lines, masonry materials, and a neutral palette of whites, greys, and blacks.",
           paragraph3: "The Sunset Cliff Villas are a part of Hudayriyat Coast, located on a cliff edge with breathtaking sunset views and direct access to a private beach. The villas are expressed through fluid, organic forms, cascading terraces, and a harmonious mix of natural materials like timber and glass, offering a tranquil and sophisticated living experience."
        },
       teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
  
       galleryImages: [
           "https://aedasme.egnyte.com/opendocument.do?entryId=022bf0c4-b4c3-4f8d-b18b-9cce68b0f467&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
           "https://aedasme.egnyte.com/opendocument.do?entryId=c74c1170-6335-4a06-80f1-8f0da68bd78b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
           "https://aedasme.egnyte.com/opendocument.do?entryId=843f5bf6-b61d-412b-b300-d31a38861c5e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
           "https://aedasme.egnyte.com/opendocument.do?entryId=ebae6484-df6b-4b79-954e-c2f9ada81740&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
           "https://aedasme.egnyte.com/opendocument.do?entryId=a2ecfd02-ca1e-4e41-bb8f-7fc5118e4250&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
  
    },
    
  { 
    id: 30,
    title: 'RED PALACE',  
    abbr: 'RED', 
    image: "./ICON/RED.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ae6c82e1-2952-4ca5-ab8a-f6bd2ecebd49&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=a0acfb98-9db4-447e-8946-575e4fd4abaf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021, 
    client: 'BOUTIQUE GROUP',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/RED.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/f361b7bc-303d-4889-833a-3e0f293516d5',
    animationLink: 'https://aedasme.egnyte.com/navigate/file/3fffb00f-85f6-4b8c-be3c-68073831bc0d',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/f64b117c-fc58-4cb4-b9f0-ae48d1788fb3',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmVkIFBhbGFjZSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    threeDLink: 'https://aedasme.egnyte.com/navigate/file/ad484fce-ddba-4db1-be99-5f90673d77ce',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=83243eaf-9d1c-4e07-ab20-394f4700aea3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The Red Palace, located in the historic Futah district at the heart of old Riyadh, Saudi Arabia, is a culturally significant building that was originally constructed as a gift from King Abdulaziz to his son Crown Prince Saud. It served as a personal residence for King Saud until 1956 before being repurposed and reimagined as a luxury hotel by Aedas.",
        paragraph2: "The project's aim is to promote Saudi Arabian heritage and culture while achieving profitability and financial returns. The Palace's unique architectural design blends traditional and modern elements, featuring a vibrant red terracotta cladding system and a grand entrance leading to a series of courtyards and gardens.",
        paragraph3: "Accommodations include 70 keys of luxurious rooms, suites, and villas, each designed with modern amenities and stylish decor. World-class facilities such as a spa, fitness center, restaurants, and event spaces will offer guests an unforgettable experience."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=0de1cab0-9cd8-4223-aac3-a1bc735fcc17&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=285f17f1-9348-429c-9bfc-30cc2be39125&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3f5ff556-7a30-4b96-90b9-f9d1ee1cfae9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=dffd9dc1-c2be-4e95-87a0-312388aa8135&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 31,
    title: 'MBC PUBLIC THEATERS',  
    abbr: 'MBC', 
    image: "./ICON/MBC.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b185ede2-1c13-40de-95cf-2516df6dcc1c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=0dd3e886-34bc-418b-8143-2f90ed3303fd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'MBC',
    program: 'OTHERS', 
    typology: 'THEATER', 
    location:'KSA, SAUDI ARADBIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/MBC.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/2641789c-4173-4bc1-938e-2a240a4b5e73',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4dbb3b25-7afe-4186-a7c4-c56d483e743f',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/e30a6e1d-6f9b-43ae-bf39-31b7cb8af000',
     threeDLink: 'https://aedasme.egnyte.com/navigate/file/8d10af51-31ba-4efb-9673-363b4cb107b6',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=3dd3d0c8-9ab3-4834-ad0c-bce88ac1a95c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nestled in Riyadh’s vibrant Events District within the Al Diriyah Gate Phase 1 development, the MBC Theater sits at the crossroads of culture, heritage, and innovation. Surrounded by iconic landmarks such as the UNESCO-listed At-Turaif District, the serene Wadi Hanifa, and King Salman Square, the theater enjoys panoramic views of Al-Turaif, the lush wadi, and Heritage Square.",
        paragraph2: "The project bridges tradition and modernity, drawing inspiration from the Najdi mud-brick heritage of Al-Turaif while reimagining it with contemporary simplicity and elegance. The design reflects a harmonious blend of historical reverence and modern functionality, creating a timeless cultural destination.",
        paragraph3: "Spanning a plot of approximately 50,000 sqm, the theater complex features two main performance spaces, a rehearsal theater, an academy, a dynamic F&B and retail hub, a visitor center, versatile meeting spaces, and an exclusive VIP lounge. The MBC Theater redefines the role of a cultural venue, offering a holistic experience of learning, entertainment, and community."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=89d138fd-1818-40d3-911f-03a851c3164e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=28bd05f1-eaca-423a-85c1-78e3184a2226&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e37231cb-bc6c-4398-a4a1-80f9a4b40519&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 32,
    title: 'RIXOS BRANDED RESIDENCE',  
    abbr: 'RIX', 
    image: "./ICON/RIX.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=47345831-0b04-4495-b0db-1a099c4aab27&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=ad18a64c-2b96-4761-9e29-2764e082c03f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'EAST & WEST PROPERTIES',
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'M', 
    epoch: 'PRESENT', 
    tags: [
        'HIGH-RISE'
    ],
    hoverImage: "./hover/RIX.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/bfa5767f-a1e5-4b94-b9a3-6a587168830f',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/04c5a512-9193-4f1a-946b-ba02edb2f6d5',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUklYT1MgQnJhbmRlZCBSZXNpZGVuY2UiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    threeDLink: 'https://aedasme.egnyte.com/navigate/file/a6ed3d3e-cb5b-473d-ac97-b4fee9262a84',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=adaa2678-ef6c-44b5-b29c-02c2930f0cc0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nestled in the heart of the city, this iconic development introduces the world's first standalone Rixos Residences, elevating luxury urban living. As Dubai's second tallest residential tower after the Burj Khalifa, it occupies Downtown Dubai's final corner plot, offering breathtaking views of the Burj Khalifa, Downtown, and the canal.",
        paragraph2: "The design blends elegance and functionality, with three distinct zones: a 32-floor Low Zone, a 27-floor Mid Zone, and a 12-floor High Zone featuring penthouses and premium vistas. Thoughtfully crafted to align with Rixos's core values, the architecture harmonizes with its prime location.",
        paragraph3: "Boasting cutting-edge amenities such as fitness facilities, yoga studios, golf simulation, a kids club, and more, this landmark redefines luxury living, setting a new benchmark in sophistication and lifestyle innovation."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=8095fb63-a219-48dd-8bbe-ce171f9b16a8&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0a41274b-72ea-4daa-8f04-703c6fef607e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3202bfe8-d923-4571-af17-af44a935a356&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=308fcbf5-9052-49e0-9c8b-1e52120547dd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d92ad48a-1ac2-483f-95ea-5cf15b141d72&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 33,
    title: 'LIWA CAMPSITE',  
    abbr: 'LIW', 
    image: "./ICON/LIW.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d7b6a4cf-d5da-4a85-991c-0b8b544e4a93&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=f436e721-85b6-43d3-bc02-fdbc9c9e393c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2022, 
    client: 'MODON',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'ABU DHABI',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/LIW.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/647b4287-f475-4bc7-921c-90c1768d0bcd',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/ae7525ae-a7c0-4b13-94c8-5bb13f21213e',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/dd9b9175-5925-412f-9d7e-fe29485ff592',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=91d5b51a-6b2c-41a4-b921-ceee5dfbe981&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=17c22476-c765-4744-88d7-b076730bf9a5&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=fce5f19d-19d3-4f9f-bd9d-e5d933d91770&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4a208224-b928-416d-bed9-94af58a5eec8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5886e056-7386-4d14-836b-1db4bf99f918&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=440bd23b-60b6-4234-8eed-634d1eda1962&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 34,
    title: 'THE NOOK (WASL GATE PHASE 4)',  
    abbr: 'NOK', 
    image: "./ICON/NOK.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=419d8a25-b964-4b60-8215-909ba96846c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=ca73f420-cca2-4155-abe8-c7dd4608b01a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2018,
    client: 'WASL',
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'M', 
    epoch: 'PRESENT', 
    tags: [
        'BUILT'
    ],
    hoverImage: "./hover/NOK.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/18f593fb-2503-4185-a82b-7422bc5ee327',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiV2FzbCBHYXRlIFBoYXNlIDQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/b041ef64-85ed-4a8e-88cd-3b7dc7a9a533',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=aebec6fe-12f6-4e8c-9bac-9ef7a4b9b62f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=2d0f04c6-7a73-427c-9d3f-7c2e50040b19&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 35,
    title: 'SIX SENSE FALCON NEST',  
    abbr: 'Six', 
    image: "./ICON/SIX.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f2ada69d-e5e1-4258-84de-bc9b1becf8fa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=272eb7d0-5cff-4afd-a343-8634a2530d56&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'DGCL',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'PAST', 
    hoverImage: "./hover/SIX.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/cdbf8753-a84e-4889-8d88-27d1bff01492',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/0cf8ba56-7d0f-4a7d-9651-aa9b4ada226f',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRmFsY29ucyBOZXN0IFNpeCBTZW5zZXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    threeDLink: 'https://aedasme.egnyte.com/navigate/file/6816614d-1bc0-4ff9-b0cd-3343a4d27c87',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=919217be-2578-47f7-a62c-31159a0dc24a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=f1927683-e408-48c6-9896-7257de1a6517&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ab8b72c4-337d-485a-a324-790c27aab99c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=423b10af-23af-4d25-827b-08cece7d9dd6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6b798be1-62a6-4ff8-9fee-45db29f366fc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 36,
    title: 'JEDDAH RENAISSANCE VM',  
    abbr: 'Jed', 
    image: "./ICON/JED.png",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f8a26cc4-7ec9-4f3a-b992-94e898c9cd19&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=a2186a44-ea11-44f5-9137-0456bda2d923&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'ROSHN',
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'PAST', 
    hoverImage: "./hover/JED.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/3310a680-8728-48f4-b680-45f4b0c45493',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/11860c71-7b8d-4a3d-abcc-8920d5a34057',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/11860c71-7b8d-4a3d-abcc-8920d5a34057 ',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSmVkZGFoIFJlbmFpc3NhbmNlIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=c2436821-b7bb-401a-9e5f-9dbbe81f9a99&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Rihla, meaning “a journey through nature,” is a masterplan competition that aims to reimagine Jeddah’s greater downtown as a vibrant and connected urban center.  As the centerpiece of the Renaissance project, Rihla seeks to redefine Jeddah’s identity through contemporary design and urban revitalization, positioning the city as a modern global destination. The project combines strategic land use, mobility solutions, and community-focused spaces to enhance residents’ quality of life and foster sustainable growth.",
        paragraph2: "The masterplan draws inspiration from the cultural richness of Al Balad and reawakens the historical significance of Old Makkah Road. This iconic pathway is envisioned as a serene and accessible journey through the heart of the city. Urban gateways—five symbolic entry points—mark the transition into Jeddah’s reimagined neighborhoods, welcoming visitors and residents into spaces of cultural and social vibrancy. Dynamic urban plazas serve as gathering places, fostering interaction, cultural exchange, and a sense of belonging.",
        paragraph3: "Rihla presents a bold vision for Jeddah’s future, where the past and present converge. By integrating innovative public spaces and prioritizing community connectivity, the masterplan transforms the city’s downtown into a thriving, cohesive urban fabric that celebrates heritage while embracing progress."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=cea04816-feb1-4618-af3a-de1161656f79&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9a4ff143-70dc-4614-9f84-05cf48c5b5f7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=b294cd64-d426-431e-8c59-b1af174d0355&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5386379d-bf74-42e9-af53-0b36529322a8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9ff0d548-ef62-485e-9109-6d3b6a14c682&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e42d2a41-d64d-4190-afbd-4b956328fe31&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"

    ]

},
{ 
    id: 37,
    title: 'DGDA CAPELLA',  
    abbr: 'CAP', 
    image: "./ICON/CAP.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=cbded34f-bcc4-433e-a2f3-117a2cff9f89&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=5c45dca9-ae55-4732-bfc2-e75c6b28b68f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020, 
    client: 'DGCL',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/CAP.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/139fdc72-8288-41cc-92a6-4486b1260607',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBDYXBlbGxhIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/1ba469d8-e138-4cf6-89f4-44eb8473707c',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/58aa2999-8e13-4b59-befd-ab35ac140fae',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=72abcc10-4ce2-4cc9-8353-16c052dca496&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=e2f7aa75-d34f-468d-bbe7-0e2551950224&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d9799ae7-e2f6-4b56-9e7d-895a404aad2d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3da27d0c-29fe-4b35-a0ab-c00fd9423ddc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4acf59bc-8ba1-42d7-b71a-3173b1a9cfaf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"

    ]

},
{ 
    id: 38, 
    title: 'CORINTHIA RESIDENCE',  
    abbr: 'Cor', 
    image: "./ICON/COR.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d430e449-dc16-43b9-98c5-0906da73eb73&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=e81bcf78-cba3-48f5-ab95-d16e72b93fd2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'UNITED DEVELOPMENT CO.',
    program: 'RESIDENTIAL',
    typology: 'RESIDENTIAL', 
    location: 'QATAR',
    scale: 'M', 
    epoch: 'PAST', 
    tags: [
        'HIGH-RISE'
    ],
    hoverImage: "./hover/COR.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/b470d37d-7309-4711-a6d6-a4ec54c61dfd',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/9ac4fb2b-3f5a-4771-b415-390602bbb25c',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQ29yaW50aGlhIFJlc2lkZW5jZSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    threeDLink: 'https://aedasme.egnyte.com/navigate/file/12d2d573-3fcb-4322-ad93-23950fccdedf',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=819c35e6-b531-47c5-9e2a-88e64cba039e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Drawing inspiration from the renowned Corinthia Brand and Viva Bahriya’s serene coastal charm, the project adopts a neoclassical architectural language. This refined design approach strikes a perfect balance between modern sophistication and timeless grandeur, seamlessly integrating with the surrounding urban fabric while enhancing the visual rhythm of the skyline.",
        paragraph2: "The residence is thoughtfully designed to prioritize well-being, comfort, and connectivity. Carefully crafted spaces encourage a fluid indoor-outdoor lifestyle, offering residents an elevated experience through branded apartments, state-of-the-art health and fitness facilities, serene pools and decks, F&B outlets, and inviting lounges. The integration of vertical greenery becomes a defining feature, softening the façade and enriching daily living with a strong connection to nature. Expansive terraces and landscaped areas create tranquil pockets for relaxation, providing a refreshing escape.",
        paragraph3: "Designed for Corinthia Hotels, a leader in luxury hospitality, the residence stands as a symbol of exclusivity and architectural sophistication. Articulated elements such as the bold crown, elegant corners, and layered base provide visual rhythm and grandeur. Corinthia Residence not only complements its iconic surroundings but also sets a new benchmark for luxury living in Qatar."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=b01bb5de-e7e3-4751-a4c1-ba5e16da24b9&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3885ed76-f539-4efa-9398-711717e2bf70&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e369c607-ff4c-458b-9ddc-fdca75c5b49b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=cb31e9a2-e61a-4385-b067-3eb3c3f49df8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d68d3a97-f577-400d-b431-fb02806142d4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]


},

{ 
    id: 39, 
    title: 'DGDA FOUR SEASONS',  
    abbr: '4SN', 
    image: "./ICON/4SN.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2066ffea-8780-4aba-be6d-6247c3f1f2a9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=d4e68a16-7fc1-41b5-99ee-bf6a1e1a6907&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021, 
    client: 'DGCL',
    program: 'HOSPITALITY',
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/4SN.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/9b972212-21a0-437b-ad3c-b0d5ab97eda3',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/24d0beeb-3be3-479f-a4bf-b69ef585975b?p=',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBGb3VyIFNlYXNvbnMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/34651a21-3d42-412f-9659-df6ba953ebbd',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=e8be0ef9-3d08-4631-aa11-9ab2569b65a3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=4f40a556-a6a9-404d-bb46-69c38b8438c1&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=676e2c72-a271-493e-9d00-e84d705000dd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=7a2effcc-9ff0-4822-9a54-1d7c19c4d0f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=1eb01e15-f10c-463c-9cfc-e1b60dc64b25&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=aa72aa89-382f-4256-88b8-76a8f88b7c4b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 40, 
    title: 'DGDA ORIENT EXPRESS',  
    abbr: 'OEX', 
    image: "./ICON/OEX.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f7418820-dd45-4aa0-887c-1e400a683b20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=636a90fb-dadf-4db6-9fcb-6e60aed2f1ad&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021, 
    client: 'DGCL',
    program: 'HOSPITALITY',
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/OEX.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/903417ec-3e83-4c97-a6b7-a040d9262ad4',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/36e566aa-958f-4a60-8640-143f551f6246',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBPcmllbnQgRXhwcmVzcyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBPcmllbnQgRXhwcmVzcyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=734040e7-7134-4f84-ad77-e91b5a069364&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=3966797f-33c0-4b91-af22-d26025246c44&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=af7219a6-2bae-45f7-a952-52f3818b35f0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ee1eefbf-ea5f-48a2-827b-4cd268214e86&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0a6b585d-ab33-41a7-9236-de0b3b4c1b2a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 41, 
    title: 'FOUR SEASONS OMAN',  
    abbr: '4SO', 
    image: "./ICON/4SO.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a05830e2-b481-4037-be1f-c0f6518ed3c4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=59996ffa-c2a9-429e-a9b6-e29b9dae4170&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2022, 
    client: 'OMRAN GROUP',
    program: 'HOSPITALITY',
    typology: 'HOSPITALITY', 
    location: 'MUSCAT',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/4SO.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c1985eb4-7bac-4144-94bd-373e5ad35ebf',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/65bd6317-2c4d-4833-8db5-5bb8e59c5b3b',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index%2F2.%20Hospitality%2F2A.%20Hotel%20%26%20Resort%2FDrawing&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRm91ciBTZWFzb25zIE9tYW4iXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/bd70a130-f23b-4760-97d0-de12a3594bc5',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=c7cdbe9b-8b8d-41c6-b07c-331ff82145a5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=03ceab98-c500-4314-8efa-96c96cbb2110&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=8415aa99-6ffe-475b-b933-cc982cb472ea&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=821f7d68-5f38-4dd6-8f4f-21f743d0e2f6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=b66471f2-6451-4237-8a77-905a7590d10d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=766d561c-8ee4-4bc4-a8d1-4998c185acaf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 42, 
    title: 'WADI TAYYIB GOA',  
    abbr: 'WDT', 
    image: "./ICON/WDT.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=888c523b-5a22-4eb2-b7ad-6edbe1b08a9a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=fe2785b8-4044-4891-9943-db744cc7cc43&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2022, 
    client: 'NEOM',
    program: 'HOSPITALITY',
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/WDT.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/21cc6fee-e45d-4b38-ae98-8fb0ed555c46',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/438bcd94-6e52-4316-929d-28cfb6841ddb',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR09BIFdhZGkgVGF5eWliIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },

    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=08046d11-a41b-4ab3-8a8a-036544344b76&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

   
    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=03f5a5c1-2b4c-4484-a46e-7cd635adb7ba&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=def60ca2-4aed-44e2-b58a-bdebc64c666e&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e4f2aee9-2774-47fb-b5fa-9947e73b3eb7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9e8cb034-5514-47a7-9e81-bf5a4dfce3c2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=74aa1dac-18f9-436d-b422-d36b32b49e73&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=aa4d31d6-af8d-468e-817b-def14d1e820f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 43, 
    title: 'MAF CCMI',  
    abbr: 'MIR', 
    image: "./ICON/MIR.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=92471fc4-1dfa-4125-a11c-e976b3424194&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=40e48dbd-f960-4054-a274-8de9fbd63e49&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'MAJID AL FUTTAIM PROPERTIES',
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'DUBAI, UAE',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/MIR.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/1e4d5a64-86c1-4b5d-9c55-66fa18b2088a',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/2144a03f-478c-41a3-9c0e-e5e5454c030d',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index%2F1.%20Residential%2F1A.%20Apartment%2FDrawing&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTUFGIENDTUkiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=cc5d2f93-1d6e-4040-ad94-dd60fe3cdc56&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "With direct access to the Grand Boulevard Anchor, the Hotel provides stunning views of the Opera and Wadi Hanifa. Nestled close to the At Turaif UNESCO World Heritage Site, the development spans 22,000 sqm of GFA and includes a 200-key hotel, a club, a culinary school, a rooftop pool deck, and a signature restaurant.",
        paragraph2: "The architectural concept emphasizes a duality between formal and organic design elements. The Boulevard-facing façade mirrors the discipline of French urban design, while the plaza-facing façade adopts a natural, wadi-inspired form. The expanded plaza creates an elevated experience, framing the Opera as the centrepiece and cascading into an Urban Amphitheatre, where the hotel rooms provide the best seats for this theatrical arrangement.",
        paragraph3: "Terraces enriched with over 15 species of local vegetation, sophisticated detailing, and natural materials add depth to the room experience. The inclusion of a vertical garden redefines urban living by offering tranquillity, privacy, and a unique connection to the surrounding environment, ensuring guests feel both at peace and immersed in the city's essence."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=6e73d33d-b9f0-4f90-8f01-7fad0fa5c25e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=cc02b48c-e152-4a18-8361-335a47c99d3d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=306e7204-759f-4415-a969-c3246ebbc0f8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 44, 
    title: 'PIF INNOVATION HUB DESIGN',  
    abbr: 'Inv', 
    image: "./ICON/INV.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ac3a721c-a05b-4320-9cdc-acaae165aca5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=bd1ade04-a796-4cbc-945f-9a25c1acf9d6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024, 
    client: 'PIF',
    program: 'OFFICE', 
    typology: 'OFFICE', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/INV.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/folder/35d18d5e-a557-4ad1-9a4b-c047d86e4c7d',
    animationLink: 'https://aedasme.egnyte.com/navigate/folder/f4d44ad6-a5c3-4cac-9dab-20cc92141bc5',
    visualLink: 'https://aedasme.egnyte.com/navigate/folder/603d9b39-1ebe-46ed-aee5-7a699f9d74a2',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUElGIElubm92YXRpb24gSHViIERlc2lnbiJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=339a74ef-d20c-4867-b126-60e29ed07604&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The PIF Innovation Hub in Saudi Arabia emerges as a visionary architectural project that redefines the future of work and innovation. The proposal explores how buildings can change, reflecting evolving functions and societal progress. Three unique design approaches—Unfolding, Pivoting, and Revealing—offer distinctive responses to this concept.",
        paragraph2: "Unfolding introduces a façade that appears to peel open, symbolizing Saudi Arabia’s journey of innovation and growth. Its sharp, angular design mirrors the country’s ambition to unveil new opportunities and possibilities for the world.",
        paragraph3: "Pivoting focuses on dynamic movement, with a segmented façade that rotates and adjusts. This approach emphasizes flexibility and progression, aligning the building’s purpose with the ever-changing demands of technology, sustainability, and innovation.",
        paragraph4: 'Revealing showcases a glowing façade with reflective surfaces and perforated screens. Light plays a central role, transforming the structure into a beacon of inspiration, inviting the world to witness Saudi Arabia’s emerging leadership in global innovation.',
        paragraph5: 'Through these three transformative options, the PIF Innovation Hub becomes more than just a building; it is a bold statement of change, symbolizing adaptability, creativity, and progress.'
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=34425893-a96f-4b13-90ed-58ba92dfcac2&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=698cdbe0-cca7-414e-b296-9b4d945fc004&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=559d9b58-3c5e-4a49-91d4-1f4eb982e28b&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 45, 
    title: 'THE CUBE',  
    abbr: 'CUB', 
    image: "./ICON/CUB.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d398e4ae-3b3d-405e-833f-ad58ce528705&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=1d9373bc-2f45-48d4-a8d3-be833b4a5167&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021, 
    client: 'NEOM',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'S', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/CUB.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/f07e96c3-6a0d-4d7b-b5c6-1229f881e726',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/6eaee40c-7e7d-45d0-ab01-dc5fc987e307',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=087b2be0-0132-44ea-ad7f-337cf38d9185&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=487f3eac-f51b-4161-8a21-272ec6f6d6b1&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=dbce05ca-46a8-4f2c-92c4-129ceba51598&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4d7c8fc4-ba9e-4d80-a90d-e07146e62b45&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=a542ca11-e9b4-4e60-8d30-2b6b11df6872&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ec17a046-955f-4857-9cc2-d5bb8f914d48&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 46, 
    title: 'EMAAR PARK HEIGHTS 3',  
    abbr: 'EP3', 
    image: "./ICON/EP3.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=dc4e1490-a4d9-4b31-a84a-a7d55b57c444&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=c93a17e7-dea8-4e4e-9b6f-1e3b9f6da388&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2017, 
    client: 'EMAAR PROPERTIES',
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/EP3.png",
    presentationLink: 'https://aedasme.egnyte.com/opendocument.do?entryId=17880ede-dafd-4916-a118-a18c69fa5b95&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRW1hYXIgUGFyayBIZWlnaHRzIDMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/7320d5a8-4d73-49c9-af3b-6a0add675b95',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRW1hYXIgUGFyayBIZWlnaHRzIDMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLlNLUCJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=e263b3af-383d-4d4b-9dea-00b5c2eec16b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=17880ede-dafd-4916-a118-a18c69fa5b95&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2e998c0e-ea72-4c61-8a27-14b32f9acd66&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=f003dfc2-6282-4e7a-b71c-ce4b96bc4070&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e0f73420-03f5-4d33-8df5-9cad60cdbe5b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0c751c61-cc04-44e2-9f0b-e283d7448120&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=fdc3d9c6-9a77-4ebe-b2b9-c3900994f714&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=a2bac666-c4f1-4350-85f9-110bd563e99d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 47, 
    title: 'NEOM GOA JUNGLE CLUB',  
    abbr: 'JGC', 
    image: "./ICON/JGC.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=638a4286-ff09-433d-b7a5-d49ae64c467d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=e75b1110-19d0-4248-ae33-35b2fb0d218a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2022, 
    client: 'NEOM',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/JGC.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/505c2c34-a1d0-4741-9dbe-49e1f057482f',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR09BIEp1bmdsZSBDbHViIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/573ff954-6dcb-4b39-b2f7-70c66ae2c6c7',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRW1hYXIgUGFyayBIZWlnaHRzIDMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLlNLUCJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=e287670f-3f3c-4014-9e3e-12c8ad895b8d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=075b15c8-7424-45c3-ad04-551505e4f1d3&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=c9b3af4a-8897-46db-ba27-9296eb26f436&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=bba58176-f124-4dab-a8ef-5aac50eb0295&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=02160fa2-a954-4d96-94a3-00046a4f7bc3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=1a44b25c-49d9-4729-87bf-ce7b75acf6b3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=f2c1dc5f-049b-4d81-9a8a-eea419dae0a4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 48, 
    title: 'DIFC 2.0 MASTER PLAN',  
    abbr: 'FC2', 
    image: "./ICON/FC2.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a08404da-a5fc-42aa-bb3f-eeaa18d4ad78&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=dd53274d-ca33-473b-a98e-288d327cd7f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2022, 
    client: 'DIFC',
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'DUBAI, UAE',
    scale: 'XL', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/FC2.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c5c5b3d9-07d8-4433-b056-9a72639ff162',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/354b6b7b-2b28-429b-aa9a-714954c170b9',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/b3945c4a-fcee-4312-b2bc-4ca1675924b2',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRElGQyAyLjAiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=14afa883-e65d-4c44-a98f-308e5ed62ed7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=49f3985e-ffc4-4c49-93b5-49f897df2529&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=fa930548-4de7-4441-8817-09027ced9424&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=90269ee1-28fc-4233-a01d-4dacd5e8736d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=7f50c73d-8c75-4d8d-b2ca-2c1747fa5237&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ff1a5aa1-23ca-412a-b215-0de24edecb10&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=03b1f0d6-9bd6-4df2-8f8b-a03391ceca9c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 49, 
    title: 'NEOM INDUSTRIAL CITY',  
    abbr: 'NIC', 
    image: "./ICON/NIC.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=62a283a2-6d4d-4256-bb66-1c6bc1cce459&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=7ccb5b1f-8858-445e-82ee-ce3444808e52&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2019, 
    client: 'NEOM',
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/NIC.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/43be5692-d056-4385-8c54-7324d70128c2',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/b6d11ec9-ad9e-4ec8-90ee-9d2eb2c78703',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/4db3de85-8158-474c-b115-b450e5edb0d5',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=45022c74-1852-4cb5-b41e-f7fece922258&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=922eea93-f5ba-4526-b307-dcc786519289&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5a7e1aaa-9da4-48f4-9295-3b7707bd37cd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=845b373a-15f9-49a2-be9b-5f30cc3ec488&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=b73e3236-6729-40df-bc7c-768e53cca30f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=90937a63-0aab-4136-8551-27a6f5dfe9e2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 50, 
    title: 'NEOM MOUNTAIN MANSION',  
    abbr: 'MTN', 
    image: "./ICON/MTN.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=15e0641e-da3f-481b-9e95-cda3b3db2cd3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=769afbb1-c1fe-4067-8d25-f0316736403a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020, 
    client: 'NEOM',
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/MTN.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/e086e834-5ed2-4da3-b2d5-9ff653ecf69c',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/4975f5d1-a679-4cc0-9ab8-0107eb1d97d3',
    threeDLink:'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTkVPTSBNb3VudGFpbiBNYW5zaW9uIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',    
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=2a6a7cba-64b1-441b-83f5-23ed60ee979f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=fae5c923-6709-47c3-b638-46b6846c4526&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2366a323-5a4c-4946-9480-d3fc16c6361c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=74cb1f6f-cc34-41b8-8bf4-63bf9af6caed&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ee1e814d-dea8-4af4-9691-b0dfb4c3ebeb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=bc722d1b-ffee-4d47-9ce6-2c530aa7a7d6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3eb42abf-5230-49f3-ab38-c4201937a2ef&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 51, 
    title: 'HUDAYRIYAT RESIDENCE',  
    abbr: 'HDR', 
    image: "./ICON/HDR.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7455831f-60ef-436b-bf46-1f0167649761&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=55e96d9f-3851-4389-adcc-8eac046994f4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2019, 
    client: 'MODON',
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'ABU DHABI',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/HDR.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/14dfd7d9-e7a6-4747-9012-2c33f6a80adf',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSHVkYXlyaXlhdCBSZXNpZGVuY2UgIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2736a97e-c3d0-4b87-8e97-07052d54b990',
    threeDLink:'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSHVkYXlyaXlhdCBSZXNpZGVuY2UgIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',    
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=c40cd995-e254-4e3a-863c-08b9632bc0a1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=3af4b4f7-d222-4294-bd6e-7a35020edcc7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=a5124fe4-4146-49ca-9e82-3ffa25e95585&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=cd56aecc-2df3-432a-978f-9d99023f7927&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 52, 
    title: 'THE COVE – HUDARIYAT ISLAND ',  
    abbr: 'COV', 
    image: "./ICON/COV.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=0b27ea8c-33a1-4985-bf32-b642c0345c77&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=e9c251c8-1b2e-4797-b9a3-0ffdee801d21&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2019, 
    client: 'MODON',
    program: 'OTHERS', 
    typology: ' RETAIL / F&B', 
    location: 'ABU DHABI',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/COV.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/58907a6d-bbdf-4aa6-a14a-c06ed48a74cc',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiVGhlIENvdmUgSHVkYXlyaXlhdCBJc2xhbmQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/94f74bdd-5f2f-4106-9695-89ac2fd75124',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=b177d7d6-394d-479e-a75c-2b792a51f14d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=8fdcad73-c273-4c5c-bef7-1bf0fb9fbd09&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=1dc1ad99-abac-428f-b394-c7d5ac05069b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=7b8691af-ede4-42fb-b7d5-c10b1ca160c3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 53, 
    title: 'SOBHA HOTEL & RESIDENCES',  
    abbr: 'SBH', 
    image: "./ICON/SBH.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=48cfce39-4ec4-4136-b806-95036d2c3696&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=2598e5c9-2978-4dbc-ab07-5c8d5e32fb20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021, 
    client: 'ELLINGTON',
    program: 'RESIDENTIAL', 
    typology: ' RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/SBH.png",
    tags: [
        'HIGH-RISE'
    ],
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a9691cb5-31e5-48cb-8eb3-f766228f31f4',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU29iaGEgSG90ZWwgJiBSZXNpZGVuY2VzIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/1768dc9f-e98c-4da9-9f38-6353eb770fbc',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/01b80b81-c43a-4f24-8e48-be91fed57b7c',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=6f3d4bfb-f87e-4a14-9caa-430507cd567f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=ab495951-a93f-41fc-a258-c46a7a185433&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ffe0d2e0-6297-413c-8728-0344f3885cde&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=b80352d6-90bf-4051-b755-1386159ef2a2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ed1339f8-a6fb-4560-88f4-a2ea20569ca1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 54, 
    title: 'SEDRA ROSHN',  
    abbr: 'SDR', 
    image: "./ICON/SDR.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ce5b5b6e-a9a5-4b47-b90b-d0435c23b931&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=5531d76d-dc8e-4996-a022-4f19e3769a1b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'ROSHN',
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/SDR.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/db568da4-9f9a-4c45-940e-9a9824563cfe',
    animationLink: 'https://aedasme.egnyte.com/navigate/folder/887fec72-55a8-486b-bcdd-40ba2f8981df',
    visualLink: 'https://aedasme.egnyte.com/navigate/folder/65ab2a06-469a-4a8a-9b00-e64135af30ee',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU0VEUkEgUk9TSE4iXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=02211050-138c-48ce-9db7-89a3c90f1426&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The masterplan envisions a future where Riyadh’s urban, natural, and cultural heritage merge into a seamless narrative. Rooted in Al-Turaif’s historic fabric, the design integrates the Wasis—Riyadh’s natural fabric—while weaving cultural heritage into its modern urban spaces. The project introduces a dynamic canopy structure that undulates across the masterplan, creating unique spaces for gathering, shade, and activity, while echoing Riyadh’s natural and architectural landscapes.",
        paragraph2: "The masterplan consists of two major components: Riyadh Gateway and Sedra Expansion. Riyadh Gateway is divided into seven districts, each drawing inspiration from Saudi Arabia's geological formations, cultural richness, and natural landscapes. From entertainment hubs to business fronts and hospitality centers, the districts reflect an interconnected tapestry of spaces, offering diverse community experiences while celebrating the region's heritage.",
        paragraph3: "The Sedra Expansion introduces a distinct residential neighborhood characterized by lively streetscapes and green spaces. This extension fosters a sense of belonging through its walkable environment and community-oriented design. Together, the project creates a sustainable, future-forward vision, seamlessly blending nature, heritage, and urban life to redefine Riyadh as a city where the past and future coexist in harmony."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=ec2b300d-ca04-475c-8d17-354ca1fbd8a0&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=493bef34-bab0-4f6f-9c17-565a0c27c410&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ca09cf34-0cf3-431b-814b-b57a02f6fa73&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=de708ed5-41b2-4899-a97e-27128d41acc4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=98c5be81-4336-42e4-8684-cab83e098f2d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=872b2b1c-f39a-4fe4-992a-30a5c3d6f451&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"

    ]
},
{ 
    id: 55, 
    title: 'WELL HOTEL',  
    abbr: 'WEL', 
    image: './ICON/WEL.svg',
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=61aa4182-8d16-474f-b0d0-d316f2efd9cf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=8c44a521-685c-417b-a71b-73e31247a68a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'DGCL',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'PAST', 
    hoverImage: "./hover/WEL.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/345891f5-5cbe-4103-928b-79c081a0b3b1',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/e3e1de5f-8e45-4739-a3f9-a609a531e57e',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdEQSBXZWxsIEhvdGVsIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=86279832-14d1-4bdd-a37c-148486c83db3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The Wadi Safar Well Hotel, nestled within Riyadh’s Wadi Hanifa region, is a stunning urban resort that merges luxury with heritage. Situated amidst terracing hills and farm oasis gardens, the design draws inspiration from the rich Najdi architectural style with its earthy tones, intricate courtyards, and iconic towers. The project creates a serene retreat, offering panoramic views of the valley while celebrating Saudi Arabia’s cultural and natural landscape.",
        paragraph2: "Architecturally, the resort is defined by a village-like layout with interconnected pathways and carefully arranged rooms, branded villas, and wellness spaces. The terracing hills become a canvas for a harmonious design that integrates spa facilities, relaxation areas, and a farm-to-table dining experience. The Najdi-inspired courtyards serve as communal hubs, while the color palette and materials blend seamlessly with the natural surroundings.",
        paragraph3: "This vision of hospitality delivers an immersive experience. Guests can embrace desert adventures, savor local ingredients, or unwind in luxurious settings. The Well Hotel captures a sense of timeless tranquility, balancing tradition and contemporary comfort within the unique landscape of Riyadh."

    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=c87389cd-2901-475d-8f21-fcddfadcf5eb&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=01c98658-0bd7-4089-9fe9-4beb617908ae&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=534ffc2b-3168-4438-bb47-6609b2035c18&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5e30d62c-ddf8-4f8b-b553-af3500e0e80a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d09689ab-600d-455e-81a9-77e928c3d95a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 56, 
    title: 'DGII 1 HOTEL',  
    abbr: 'ONE', 
    image: './ICON/ONE.svg',
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6f7d2663-8168-434d-83d7-56632799e938&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=b4a69f57-08b5-4daa-9d93-6843e3922d60&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'DGCL',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/ONE.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/6afd0029-0421-401c-8626-0fe11706f310',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/a175a6f2-a923-42e7-9916-c4b7004dd8e2',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiREdJSSAxIEhvdGVsIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=23426662-37f8-4c7b-8d91-20db0df0b491&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The DG II 1 Hotel forms part of the Diriyah Masterplan, positioned with stunning views to Wadi Hanifa and the Riyadh skyline. The project reflects a balance between heritage and innovation, where the built form seamlessly integrates with the natural landscape.",
        paragraph2: "The proposal breaks free from conventional linear layouts, instead weaving together a series of courtyards and exterior intimate spaces, reinterpreting the memory of the local farmhouse with a contemporary aspiration. The presence of water, patterns of plantations of palm trees and aromatic species guide the visitor through a sensuous journey.  It captures the essence of Arabian hospitality, evoking a sense of calmness and refined luxury.",
        paragraph3: "At its core, the project celebrates “layers of time,” blending minimalist modern aesthetics with vernacular Najdi architecture.  The massing is carefully composed as an abstraction of Najdi vernacular, with its solidity and tectonic presence.  Traditional Najdi design elements such as openings, intricately crafted doors, columns and decorative motifs are thoughtfully reinterpreted for a contemporary context.  This balance creates a dialogue between past and present, capturing the essence of Najdi heritage while embracing modern simplicity. "

    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=546a04fc-75fd-45b8-a5b4-3764b32dde0c&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=46e9f326-3767-4585-a049-34ca18049eff&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=379aa5de-e4ed-43b6-ab95-6e86afe8d655&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4dc1135c-50d6-4563-95c0-e8196094c95a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 57, 
    title: 'NEW MURABBA',  
    abbr: 'MRB', 
    image: './ICON/MRB.svg',
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=5bc8943e-f6b4-417e-ac5c-33c658ef5199&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=4d2b83c9-0c69-41d5-86f6-e7717f4d49f8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024, 
    client: ' NEW MURABBA',
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'PAST', 
    hoverImage: "./hover/MRB.jpg",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/ba8b1a44-6608-41b1-b71d-cb7ade402cd7',
    animationLink: 'https://aedasme.egnyte.com/navigate/file/2281ff71-09cf-460e-a553-b8b6b3abf7b7',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/9a5842ae-d914-4554-b93f-a1485d3f1e02',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTmV3IE11cmFiYmEiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=31f767db-c604-4fbf-a9ec-3772c46293ad&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The New Murabba Downtown District, situated in Riyadh, introduces an innovative urban vision that combines modern design principles with natural harmony.  Located within Plot A, the project forms a central element of the master plan, adjacent to the iconic Mukaab skyscraper, a landmark that anchors the site and shapes its surrounding urban context. The district embraces the natural ravines of Wadi Hanifah, integrating the terrain into the core of its design.",
        paragraph2: "The concept sets a new benchmark for residential living with the introduction of a “Biophilic Salmani” approach. This design strategy embraces the natural landscape by embedding architecture into the Wahas’ network, ensuring nature is seamlessly integrated into the urban fabric. Central to the design is the development of a 3D city—a compact, multi-layered urban environment that maximizes land use, promotes walkability, and balances density with livability.",
        paragraph3: "Prioritizing sustainability and accessibility, the master plan introduces a 15-minute community, where essential amenities and services are always within a short walking distance. By combining biophilic architecture, compact urban layouts, and Salmani traditions, the project aims to create a harmonious, vibrant community that merges modern urban living with cultural identity."

    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=a3f0ac90-3b6c-410f-bc09-eed9e8ce91cc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d3b77587-72f7-4cfc-ab94-b1ba235c097d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=1648e058-b39d-484b-9e8e-cf35d6b29344&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=bc6d59f2-4eda-4321-b95c-d5f00f1062bb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=1b4b08f0-4fe6-4254-be8a-26825856c980&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 58, 
    title: 'TROJENA SKI VILLAGE RESI ID',  
    abbr: 'SKI_ID', 
    image: './ICON/SKI_id.svg',
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=9929f5eb-8d9d-4be5-a7bd-3fad61cee57e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=39150675-4fae-4c76-b47d-4413c0fff434&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024, 
    client: 'NEOM',
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'S', 
    epoch: 'FUTURE', 
    tags: [
        'INTERIOR'
    ],
    hoverImage: "./hover/SKI_id.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/9ef52fcd-281b-440d-9f92-268e93f0ccd6',
    animationLink: 'https://aedasme.egnyte.com/navigate/file/2281ff71-09cf-460e-a553-b8b6b3abf7b7',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/b7471cee-1ff7-43b1-a3d9-1721f92183d9',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiVHJvamVuYSBTa2kgVmlsbGFnZSBSZXNpZGVudGlhbCBJRCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=140a80cb-6f77-453c-a215-8caeb9238c22&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "he interior design of NEOM's Ski Village in Saudi Arabia reflects a seamless fusion of organic luxury and futuristic sophistication. The style is inspired by the natural contours of the surrounding mountainous landscape, evident in the fluid, sculptural forms of the ceiling and wall elements. Earth-toned materials like sandstone, marble, and warm woods create an inviting, grounded atmosphere while maintaining a modern edge.",
        paragraph2: "The space exudes elegance through its interplay of textures, with smooth, polished surfaces contrasted against layered, striated forms. Furniture pieces are minimalist yet plush, offering comfort while complementing the organic aesthetic. Large, panoramic windows connect the interiors to the breathtaking natural surroundings, further enhancing the space’s harmonious design.",
        paragraph3: "Soft ambient lighting accentuates the curves and details of the architecture, adding warmth and depth. This interior embodies a futuristic take on alpine luxury, blending innovation with a deep respect for the region’s natural beauty."

    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=1d520fed-24d5-448d-af57-7c909652b345&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9a334ed7-9253-4ca5-8bf4-0c7ae5302fdc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0e0ec452-1963-49c5-a448-7841bad82f33&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 59, 
    title: 'NEOM CHANDELIER',  
    abbr: 'CHD', 
    image: "./ICON/CHD.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=4cf8e352-2acb-4586-a4e4-631c4b217ee3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=767b076f-0b01-420e-9a69-e1fce97b8dfe&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023, 
    client: 'NEOM',
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/CHD.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/5d77838d-5917-48d5-a23a-6511540384bb',
    animationLink: 'https://aedasme.egnyte.com/navigate/file/6c15b4d0-e574-46e1-bcf7-8304a59cc19b',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/63ee167b-10aa-4d01-9b5c-c4e1599db906',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=6670f076-f9a9-4fca-b0d2-e285ded67688&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The NEOM Hotel and Chandelier emerges as an innovative vertical landmark, seamlessly integrating architecture, time, and nature. Positioned as a visionary addition to The Line, the project celebrates a deep connection between the past, present, and future. Designed to symbolize continuity, the structure embodies three distinct treasuries: the Bio Treasury, Human Treasury, and NEOM Treasury. Together, these components reflect a transformative narrative of preservation, human experience, and progress.",
        paragraph2: "The Bio Treasury serves as a vertical botanical garden, meticulously safeguarding biodiversity across millennia. From ancient ecosystems to future landscapes, this living archive reconnects humanity to nature’s beauty and resilience. The Human Treasury focuses on valuing humanity’s physical and physiological legacy, providing a repository of data that advances health and wellbeing.",
        paragraph3: "Finally, the NEOM Treasury unveils a bold vision for the future. A platform for innovation, it showcases architectural breakthroughs and digital advancements that align with The Line’s ambitions. Inspired by the ideals of preserving nature, valuing human experience, and unveiling the future, the Line Treasury represents a groundbreaking convergence of natural preservation, human ingenuity, and sustainable design."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=6694265c-41fc-45bd-b388-3f7003aa12e2&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0eaeb8eb-586d-4487-86ab-09a802662fde&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=bd02a609-3b2a-49d4-b945-f27767af64fc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=a98d88ff-9d78-463c-af7c-f7354679909c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d830c0c9-5ab0-4525-899b-efeac406d830&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},
{ 
    id: 60, 
    title: 'EMAAR SOUTH DEVELOPMENT',  
    abbr: 'ESD', 
    image: "./ICON/ESD.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=cda88777-9f2c-466a-84f8-23535e4ef65e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=05f7bd63-2332-4bd9-abda-7f1cbbf24e20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2017,
    client: 'EMAAR PROPERTIES',
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'M', 
    epoch: 'PRESENT', 
    tags: [
        'INTERIOR',
    ],
    hoverImage: "./hover/ESD.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/81bb8eba-6740-467c-87be-6f5a8b9d1ad2',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRW1hYXIgU291dGggRGV2ZWxvcG1lbnQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/63ee167b-10aa-4d01-9b5c-c4e1599db906',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=662e848b-63ff-4dec-bdd0-75ca55cb2356&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=5f0dfc7f-e9fe-4c55-af25-a97d7f2ba01a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2672f027-2302-4e59-81c0-3b11ae12d8c5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=12ea8df7-d599-4965-9f16-6cb1ee55f385&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=529472d6-de70-4658-83ee-01033f96c408&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 61, 
    title: 'AL SOUDAH MASTERPLAN',  
    abbr: 'SOD', 
    image: "./ICON/SOD.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=52c29815-5fc6-4234-8d4a-9799748f34e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=a5aec6bf-233a-4968-9dee-57cf6afe9a10&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: 'SOUDAH DEVELOPMENT COMPANY',
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'PAST', 
    hoverImage: "./hover/SOD.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/1d8a1fe1-2377-4613-8304-4bf6e39e4e23',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/b18fd439-6458-4be4-b8f1-69085ccab382',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2faa07ac-42b4-4f51-bbe5-0df0997b8200',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQWwgU291ZGFoIE1hc3RlcnBsYW4iXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=c2a94b81-3921-4517-9eb5-f335831d88a4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=310e8c0c-1a0a-4961-a041-432e7f046916&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=11991956-783f-41e7-b227-bc456700ca8d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=7bf2dea8-3e52-4a77-89d2-a329acccc8a3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=76b61662-a7ba-42f2-9662-db92e30a1963&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=f60cd248-0c7e-405d-aeaf-415aceebfc32&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 62, 
    title: 'SEYCHELLES REDEVELOPMENT MASTERPLAN',  
    abbr: 'SEY', 
    image: "./ICON/SEY.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c921d8a9-f0a1-4aa5-9915-736c11eb7144&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=d2c0b97e-29c4-4fca-98a2-d0bc31812139&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "FISHER MAN'S COVE HOTEL LIMITED",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'SEYCHELLES',
    scale: 'XL', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/SEY.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/87e9bef5-acf5-414d-ab07-474e2714b049',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/3623a2e6-bce4-4174-b119-40ff7e643d16',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/c392e132-aa3e-48c5-92e9-dd19112ef871',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c88af24d-4eab-4450-b96d-ee5a7ced7ab7',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=dd9f1797-9154-4692-9a76-23e3ab135324&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=22cb1e7c-bf2b-4c08-8f02-d3d389a6b3bd&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d00eed5f-db93-4119-b938-970b7ae46747&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=7f6253c4-8f0e-4fe3-bc0b-2b5dc983a7e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=bb362fd1-fb1a-4e6c-a7db-799ffbfec5f5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 63, 
    title: 'RIYADH HUB',  
    abbr: 'RYH', 
    image: "./ICON/RYH.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c967847e-9ff5-4904-8efd-8aa449cf1eb4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=5c88cba7-7fa8-48c1-8a60-03c9c89ed934&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2019,
    client: "PIF",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/RYH.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/61cdcdda-3771-41f1-a4b5-f5d33b09ff69',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/Riyadh%20Hub/Visuals',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/Riyadh%20Hub/Animation',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=cfd86f92-e033-4e4f-8cae-9fc27ff7b3f3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [
        "https://aedasme.egnyte.com/opendocument.do?entryId=876697c3-ec40-4239-9b69-c27476d27fa7&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=b8645575-71d1-4169-97b2-7bccd6cdcd2a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=bf37dd34-350e-4135-a67d-0ee56228c6e6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=60171f4d-b48a-4ea7-a414-dc7e5f96c00d&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=923aca90-14d7-4548-b79e-6448710e474a&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 64, 
    title: 'DUBAI METRO ROUTE 2020',  
    abbr: 'MTR', 
    image: "./ICON/MTR.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=8857013d-623a-47b0-a2a3-555815ddcc75&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=80f7e1e2-4ed7-4bec-970d-961db816cfc7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2017,
    client: "RTA",
    program: 'TRANSPORTATION', 
    typology: 'TRANSPORTATION', 
    location: 'DUBAI, UAE',
    scale: 'S', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/MTR.png",
    tags: [
        'BUILT'
    ],
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/9e38decb-7e26-4c18-b20b-05af075649e9',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRHViYWkgTWV0cm8gUm91dGUgMjAyMCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/Dubai%20Metro%20Route%202020/Visuals',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/Dubai%20Metro%20Route%202020/Animation',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=08a6b51a-bac4-43b2-9c91-343924065be7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=cc7c4eac-c71d-4571-8803-8baf564c4795&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=c2d8e3d3-fdce-4184-aa30-43099da1dfeb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2c4f952d-245f-42c0-a61b-3c710abd6644&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2017e41b-bffc-4ee6-aa39-2a58b406c479&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6f9ca880-e893-4d06-bd38-8f18d112735e&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 65, 
    title: 'JUMERIAH RESIDENCE MARINA',  
    abbr: 'JMR', 
    image: "./ICON/JMR.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=344f948e-87f1-469f-9657-64d8eca863bb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : "./ICON/JMR.svg",
    year: 2014,
    client: "SELECT GROUP",
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'S', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/JMR.png",
    tags: [
        'INTERIOR'
    ],
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/f1605d1d-c729-41be-869d-f1e861b60fab',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSnVtZWlyYWggUmVzaWRlbmNlIGF0IE1hcmluYSBHYXRlIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/46a0481a-d320-419a-b3ba-59a59e11558d',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=eac62646-bb4c-4d5d-a4ee-923263504dcd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=6572a339-6a1a-4e14-ac90-7663190a5869&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0c6c9ebd-0c05-40d8-b80c-c40807cad292&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d045056a-16d4-4079-86a3-1a84627e5820&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2258e52a-f5cf-4cc4-86c2-e9255d09c640&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 66, 
    title: 'NEOM BAY MANSIONS NEWA',  
    abbr: 'NWA', 
    image: "./ICON/NWA.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=73bcacb8-05ba-4430-966e-62b8a8f7e1a6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=d49225ef-a49e-4eee-8bc9-01cb563f252f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "NEOM",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/NWA.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/6dfdc22e-462d-49e2-8f2d-fc1ae644345e',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/851df5fa-2c14-45f4-bc87-c10ecaf21c50',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/5f1c10db-7746-4d3e-b965-ccabf2d2ffe7',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=2d481afb-cae4-48f5-a37c-1a1a651b92ee&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=cdb44664-16b6-45fc-b22c-3ec1751804d7&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=719fa3a9-76b1-411a-a175-fd10b8d96dd3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d6d7b899-a537-4548-a529-0f365c72c953&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=bcff16c2-e33c-4e6d-b736-3683da1b4c6f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=25017060-a3ef-4fb5-9549-f584cba995de&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d22ab8d5-6880-4ad4-8680-c233683fb064&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ec3c63b1-6617-46c9-9efe-cb109a018d03&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]

},

{ 
    id: 67, 
    title: 'DIFC INNOVATION HUB EAST',  
    abbr: 'INH', 
    image: "./ICON/INH.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=68f1c42f-b6e6-4a3d-8b69-9d617da8ad25&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=491e3b8a-f074-49a2-8ecf-227855d9d0a2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021,
    client: "DIFC",
    program: 'OFFICE', 
    typology: 'OFFICE', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/INH.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/50ad25bb-7a7a-4220-8e3d-09f43ee64e54',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/9169d171-c7ba-4b0e-b0dc-16769ba69960',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRElGQyBJbm5vdmF0aW9uIEh1YiBFYXN0Il19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',   
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=a097425f-a9f9-4a4d-b735-85613e8a6a64&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=d06b499a-4b9d-4f88-b986-f5f62c29a93c&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=1a3346f8-b1a5-4fc7-9b49-7caae502820c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=70208f72-3915-46e4-a252-92389d0dc34e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=70101275-bf99-44ed-9a00-0839945a5bee&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 68, 
    title: 'NEOM BAY LUXURY MANSION',  
    abbr: 'NBM', 
    image: "./ICON/NBM.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a739b18b-ee23-4c48-84bf-ca4f6c3d9b17&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=a7b6d167-dae6-4f86-8e04-425ce985f293&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "NEOM",
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'S', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/NBM.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/7cb9f303-663c-4911-9e16-3a574bde901a',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/8b0bbc0b-5e65-4baf-8194-7c76bb273b0c',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiIE5FT00gQmF5IEx1eHVyeSBNYW5zaW9uIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',   
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=3e21712f-9578-4d9a-b456-fac8c51432fd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=25d76f17-913c-4b0f-a9d7-a909ba98863e&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=16f24ac0-551c-40b5-8e4e-4781608c42c5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ee8e9574-a2b4-4d7c-96af-1852811e3746&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e811b307-65f9-4746-9df4-35f6375fef83&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=c456b6aa-274c-49f6-9347-436fb90a91df&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 69, 
    title: 'MBC STUDIO AND OFFICE (THE LINE)',  
    abbr: 'MBL', 
    image: "./ICON/MBL.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ef152d2f-e721-443d-a7e3-26935303e028&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=bc34ed70-1fba-48a5-adab-147cd45b7f2b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "MBC",
    program: 'OTHERS', 
    typology: 'STUDIO', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/MBL.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/MBC%20Studio%20and%20Office%20(The%20Line)/Presentation',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/81bbe3b6-f38d-414b-afc2-45f420b3421b',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTUJDIFN0dWRpb3MgYW5kIE9mZmljZShUaGUgTGluZSkiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=7a91f4c0-ec71-4b29-abc4-92228504b281&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=3d4d2ff9-f2e8-446e-8b5f-60eb597e96ad&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=89b6bbc2-1b3b-403a-86fa-96df76b6bf50&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=df70fd99-38ea-4c15-b342-96700ccc3b58&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6f4b4566-fa9b-43d2-9f47-efb65afd53a6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2c98c27e-9fb5-4458-9983-066e45bacf20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 70, 
    title: 'MBC STUDIOS',  
    abbr: 'MBD', 
    image: "./ICON/MBD.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a5bd143f-f6d2-42f6-857a-5de8923d7dad&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=218df03b-a6e8-4a23-8cdf-f0ef046db0cc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021,
    client: "MBC",
    program: 'OFFICE', 
    typology: 'OFFICE', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/MBD.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/29525476-c05a-4826-842c-79d0aaa7f5e4',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/158d8f0c-3f9c-4537-bb18-48f794b26b40',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=dab978b1-c9f4-49ca-a7cb-7f594c93b302&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=00525da9-c25b-47df-b6b1-066f5514d493&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d1aa3742-f67e-4911-8865-89b78e8e7aae&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=053e86f0-5975-4096-8606-59955e317d7d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=935a0298-7b59-46d7-9c58-ad1ad9801900&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0d87cc28-e1bf-43c8-be88-323f548b6128&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 71, 
    title: 'SAADIYAT LAGOONS',  
    abbr: 'SAL', 
    image: "./ICON/SAL.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=3e27220b-813f-4213-abca-77816da0915f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=8d4a7aa5-176e-4a85-be0b-999aca8db426&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021,
    client: "MODON",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'ABU DHABI',
    scale: 'XL', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/SAL.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/52ee2dd2-beec-480e-a435-01a18ebc3a71',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU2FhZGl5YXQgTGFnb29ucyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c9fdb093-ce3b-45d7-adfc-12add503d59f',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU2FhZGl5YXQgTGFnb29ucyJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=f212e6f1-7430-416e-be96-9bb5a40ce225&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=5701291c-98c7-47a3-b085-a7a8549d127f&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=f1f6b880-d559-474e-a9a9-51b2dab53c3f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e7491a1c-9930-4aad-8538-b9c3e3529b17&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6c8af2f4-3a4b-4f2e-9759-2b0dce90fad3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=635d3d36-536e-4f74-97a7-de0c20baa13c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
    ]
},

{ 
    id: 72, 
    title: 'DUBAI CREEK GOLF AND YACHT CLUB VILLAS',  
    abbr: 'DCV', 
    image: "./ICON/DCV.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6a990255-e018-426f-994b-be7cfa4a4c2a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=d1cb573d-d326-4b1c-9d04-3345e1f7dab5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021,
    client: "WASL",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'DUABI, UAE',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/DCV.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a0451099-1c92-44f6-a450-62ed171e4536',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/9ea61dfd-7b63-45b8-b5a6-08c529771aee',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRHViYWkgQ3JlZWsgR29sZiBhbmQgWWFjaHQgQ2x1YiBWaWxsYXMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLlNLUCJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=2c667e0e-3f10-4596-a5bf-af78f6158d94&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=9f46765f-c481-40ec-9388-88f196eaeba2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9fa4d8f4-6a60-490c-b014-bc957038e93b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=a4c253fd-2c50-43f1-ba1b-345a2b79c765&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
   
    ]
},

{ 
    id: 73, 
    title: 'ENOC LINK SMART STATION',  
    abbr: 'TRK', 
    image: "./ICON/TRK.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ab46b203-6b6a-4d4a-8fac-b0cc417b037b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=ef50cf52-69fd-450a-8c5e-1222d8bf65ca&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "ENOC",
    program: 'TRANSPORTATION', 
    typology: 'TRANSPORTATION', 
    location: 'DUABI, UAE',
    scale: 'S', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/TRK.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2e38298d-e138-49c0-83a0-43f28a289f86',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/5bdfa98b-2051-4709-97fc-ea5e2559b172',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/82423224-832b-4bd6-8fb9-2f19be45f4fa',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=22cf505f-a35f-41de-9a6f-2028a0bff39f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=1de2630a-8265-4e80-86c8-78227331eeb1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=123329c6-d6e4-4952-82e4-d1fe01673793&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4e479f3f-892c-412d-8a0d-59589c26da59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
   
    ]
},

{ 
    id: 74, 
    title: 'DILMUNIA MOSQUE',  
    abbr: 'DMS', 
    image: "./ICON/DMS.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d67f70cf-65fd-4f29-802e-a6e5db54c763&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=4a7d924d-149c-4c4c-acb4-397174f70969&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "COMPANY",
    program: 'OTHERS', 
    typology: 'MOSQUE', 
    location: 'BAHRAIN',
    scale: 'S', 
    epoch: 'PAST', 
    hoverImage: "./hover/DMS.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e1a6f6b0-5874-420e-8241-4fa8d5559760',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRGlsbXVuaWEgTW9zcXVlIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/f35b621a-886b-46ff-ab7f-fcd86046524e',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRGlsbXVuaWEgTW9zcXVlIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=93a1d054-58f1-465d-b201-a00c8539ef66&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=630a4a13-9173-4062-8239-408850f071b0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=75535a44-29ce-486e-b42f-a01eec481f8e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5bd7324e-0a15-4097-b9f9-6f333b017dae&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
   
    ]
},

{ 
    id: 75, 
    title: 'JUMEIRAH VENU HOTEL',  
    abbr: 'JVN', 
    image: "./ICON/JVN.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=3a3d280a-45d3-46c5-bcff-e4cc435d585b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=a63df2da-e33b-4079-9964-90c5ace712f7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2015,
    client: "AL MADDAHIA",
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/JVN.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e3adc704-24f8-4fd1-ab5d-149fffb9b574',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/dabb35ee-36b0-4b68-a076-eb6671581ead',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSnVtZWlyYWggVmVudSBIb3RlbCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSnVtZWlyYWggVmVudSBIb3RlbCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=c2e4ed93-a929-47f3-8ec8-f329e3578d48&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=222d7dbd-ec67-41db-87b2-fcd573811915&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 76, 
    title: 'SYSTRA QIDDIYA LRT',  
    abbr: 'QLR', 
    image: "./ICON/QLR.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=80eb219c-950e-4b3a-9133-a86b03ed1a14&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=7fecd5ac-eee7-4b24-9684-346768784529&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024,
    client: "QIDDIYA",
    program: 'TRANSPORTATION', 
    typology: 'TRANSPORTATION', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'S', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/QLR.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/8c1edd98-3397-4532-9ad1-b4abffc74d67',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/Systra%20Qiddiya%20LRT/Visuals',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/Systra%20Qiddiya%20LRT/Animation',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU3lzdHJhIFFpZGRpeWEgTFJUIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=4c5011ab-4d4a-42be-bdbb-e573b4af519a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Qiddiya, a landmark entertainment city located west of Riyadh, introduces a Light Rail Transit system to unify its expansive districts. With stations designed across three typologies—elevated, at-grade, and underground—the project ensures seamless mobility while complementing the surrounding natural and urban environments",
        paragraph2: "The proposal is built on three core design concepts, each delivering unique experiences. Concept 01 – <b><i>\"Fun Never Stops\"</i></b> creates whimsical, colorful environments inspired by childhood play. The design fosters joy and belonging with unstructured, vibrant spaces for community interaction. Concept 02 – <b><i>\"Nothing Can Stop the Flow\"</i></b> embraces Qiddiya’s natural terrain, integrating stations into rock formations and green spaces to create a seamless experience that reflects nature’s textures and flow. Concept 03 – <b><i>\"Ordinary Needs an Extra\"</i></b> elevates the transit experience with futuristic designs that incorporate gamification and stunning illuminated structures, transforming functional spaces into astonishing urban landmarks.",
        paragraph3: "The LRT stations not only prioritize connectivity and mobility but also redefine the transit journey by incorporating cultural, recreational, and natural elements. This visionary approach enhances Qiddiya’s urban identity, creating vibrant spaces that seamlessly merge transit infrastructure with the city's dynamic and playful spirit."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=a94cc06e-c7e8-4af8-a4e9-7d4154b1c427&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=7e35de75-5fbf-4429-b8ff-fdfa923ba361&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6cfca55b-9ff0-4c2b-bc38-dab78c460712&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=719557b6-37db-4460-8687-5074e2cc7770&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{ 
    id: 77, 
    title: 'FOUR SEASONS HUDARIYAT',  
    abbr: '4SH', 
    image: "./ICON/4SH.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=675b8260-04ee-4348-8672-ba0c5e117f42&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=8a7a1af8-8080-4700-aa41-27c5269668ed&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023,
    client: "MODON",
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'ABU DHABI',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/4SH.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/b3cd25ba-ed96-4805-9fb2-88c769a3868e',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/e05bf180-fc8d-4604-9d37-7b148a8897c3?p=',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/334d1edb-92b5-4fe8-896d-6b703c35c120',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=3b734eed-6268-4d49-b93c-5df97051e9bc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=fe1570f8-8989-46ed-9ee3-9415e2f3bff2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=99f6e296-3fcf-47bb-8b62-c1d4d54349c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=60b14cb8-29fb-4688-a42d-b3546d378775&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},


{ 
    id: 78, 
    title: 'AL NAWRAS WALK',  
    abbr: 'NWW', 
    image: "./ICON/NWW.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=af676e82-92de-4c76-b999-db26246238aa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=3f7daadf-5a57-455f-ac6a-fd818ba13542&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2019,
    client: "FAKIEH GROUP",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/NWW.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/0ab31de0-03c8-41cf-b830-4c453fbe1748',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/6237bed4-5e6d-4593-a0ab-6e97b446df9b',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/9fbd8463-c2da-49ed-a472-747b7fc496ca',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQWwgTmF3cmFzIFdhbGsgIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=3b98b299-8192-4b85-8b74-3e9d950ba6a9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=8fc124f9-e0c9-4579-a147-67c23b047757&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},


{ 
    id: 80, 
    title: 'AL-JANADRIYAH CULTURAL FESTIVAL DISTRICT',  
    abbr: 'JCD', 
    image: "./ICON/JCD.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f83b2fb1-4e96-4e4d-adaa-5244d2b0506b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : 'https://aedasme.egnyte.com/opendocument.do?entryId=c498011b-96c9-4e18-a15f-b5277e7a5c5d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "MINISTRY OF CULTURE",
    program: 'OTHERS', 
    typology: 'CULTURAL DISTRICT', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'PAST', 
    hoverImage: "./hover/JCD.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2eba256a-db29-461a-ad82-d629246de60f',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/8b42f0d4-a70e-4f2a-b9e9-bb8d7fd911df',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQWwtSmFuYWRyaXlhaCBDdWx0dXJhbCBGZXN0aXZhbCBEaXN0cmljdCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuU0tQIl19XQ%3D%3D',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=91518162-be66-411e-a590-ecdc7f38df66&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=9ea2d7a8-0cd2-45d5-b5bc-fec9760cd93e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5a3e6165-89d8-41b5-bfc3-d3f40b299a86&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=905e4604-abcd-41dc-8940-cdd150e6b22b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=03adbd44-d48d-4183-8388-081d9b3b2da0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{ 
    id: 81, 
    title: 'DILMUNIA MIX 24-25',  
    abbr: 'DMX', 
    image: "./ICON/DMX.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6793b5b0-ad36-4271-a486-c5eb62e74275&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl : "./ICON/DMX.svg",
    year: 2017,
    client: "RAHIM HOLDINGS W.L.L.",
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'BAHRAIN',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/DMX.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/25447286-50d3-4fb9-adac-a989531c7ab6',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRGlsbXVuaWEgTUlYIDI0LTI1Il19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/f5b830da-13dd-45e9-b48b-7224eb1e70a2',
    linkImages : {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',

    },
    // New fields for the description section
    descriptionImage : 'https://aedasme.egnyte.com/opendocument.do?entryId=08109844-2273-4608-898a-f33a9a3049fd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=3de25278-ab37-4cf6-847b-5569e3b8b4fa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=706202a5-32f4-4e34-a409-edcb6dc09623&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=a9267a49-2e23-4d28-9c0f-a5bcd5c2a19f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 82, 
    title: 'D3 OFFICE BOULEVARD',  
    abbr: 'D3D', 
    image: "./ICON/D3D.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=9ffdc20e-9c12-4db6-a7fa-701b6e2202d5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=ebe9728c-be1e-4cf9-be11-573508113354&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2017,
    client: "TECOM GROUP",
    program: 'OFFICE', 
    typology: 'OFFICE', 
    location: 'DUBAI, UAE',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/D3D.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/73769595-713a-449f-aaab-11c23e913d57',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRDMgT2ZmaWNlIEJvdWxldmFyZCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyJEcmF3aW5nIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/a761bd44-f190-430c-a9cb-7796b9edcf62',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRDMgT2ZmaWNlIEJvdWxldmFyZCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuU0tQIl19XQ%3D%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=e3498bb5-5b4a-4e6d-8b94-efd6f4bfd973&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The project introduces four innovative architectural concepts aimed at transforming Dubai Design District into a vibrant hub for creativity and design. Each building embodies a distinct metaphor, celebrating the intersection of form, function, and cultural significance while responding to the aspirations of the d3 Masterplan.",
        paragraph2: "The first concept, Origami, reimagines d3’s iconic façade language with fresh geometric forms, pushing the boundaries of the district’s architectural identity. Creek/Crack emphasizes permeability, inspired by Dubai’s natural and cultural heritage, with openings that connect the building visually and physically to its surroundings. Office Park introduces a unique vision for commercial spaces, integrating a green, multipurpose park designed for community engagement and mindfulness. Finally, Slide draws inspiration from education and play, featuring dynamic, sliding floor plates and shaded areas that encourage interaction and creativity.",
        paragraph3: "The proposal prioritizes connectivity, linking pedestrian pathways, open spaces, and nearby landmarks. By seamlessly integrating each building into its urban and cultural context, the designs aim to redefine d3 as a forward-thinking district that attracts designers, thinkers, and innovators from across the Middle East and beyond."
    },
    teamMembers: [
      "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=1a2993ce-3d96-4d4d-aa54-8af84643f1ca&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3238ca8b-6882-464e-b91a-76c1cb8c50a3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=41af7e1b-b061-4b5c-b98a-353ef8124882&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=c5d66b4f-4c6e-4cdc-a94c-b2cd0f30c715&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3530991e-b862-4d0d-a15b-d9e154bfcc20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{
    id: 83, 
    title: 'DIRIYAH GATE PENINSULA',  
    abbr: 'DGP', 
    image: "./ICON/DGP.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6067d5c3-698a-4764-b23a-1be9e570fbb7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=47785f86-f675-4d9b-beeb-3ef428cd6310&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "DGCL",
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/DGP.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/23ddac57-bb94-42a0-861f-b4c906654cc4',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/cfff288b-3eb3-4c1f-987d-f683466a230f',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRGlyaXlhaCBHYXRlIFBlbmluc3VsYSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiRGlyaXlhaCBHYXRlIFBlbmluc3VsYSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6465a8ca-8918-4f77-bcbc-5c59f19e403c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Diriyah Gate, developed by the Diriyah Gate Development Authority (DGDA), is a masterplan rooted in the rich history and heritage of At-Turaif, a UNESCO World Heritage Site known for its iconic Najdi mud-brick architecture. As part of this visionary project, Diriyah Square serves as the vibrant heart of the development, including an ultra-luxury boutique hotel and branded residences.",
        paragraph2: "The 80-key boutique hotel captures the elegance of traditional Najdi design while embracing contemporary luxury. Its façade design and spatial organization pay homage to the shaded alleyways and inward-facing courtyards of At-Turaif, creating a tranquil yet opulent atmosphere. The hotel is envisioned as a retreat, combining authentic cultural experiences with state-of-the-art amenities.",
        paragraph3: "Adjacent to the hotel, the branded residences reinterpret the traditional Najdi style in modern townhouse and apartment configurations. These residences focus on fostering community and connectivity, with civic and recreational spaces easily accessible within the walkable Diriyah Square. The design prioritizes the balance of solid and void, drawing inspiration from Najdi courtyards and architectural rhythms, ensuring harmony between the built environment and the surrounding heritage.",
        paragraph4: "This proposal seamlessly merges Diriyah’s historic identity with contemporary luxury, offering an unparalleled living and hospitality experience."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=804f1b3d-13d7-403f-a649-20955799326f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=24cce8dc-b4a0-41b0-8103-d251c65c0ad9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=eacc923c-5e77-4c45-9d80-2008d2aa0613&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 84, 
    title: 'ABU DHABI CORNICHE',  
    abbr: 'ADC', 
    image: "./ICON/ADC.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2a1b6680-8986-416b-9a78-012f48cff7ef&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=76779b7c-aca8-48a8-8fb2-5f14b00168a0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024,
    client: "MODON PROPERTIES",
    program: 'OTHERS', 
    typology: 'RETAIL / F&B', 
    location: 'ABI DHABI',
    scale: 'S', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/ADC.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/6cf35985-a97d-4843-aace-99231151a058',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/933df963-c7d8-41ca-bb4b-faa6831f9129',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c1d32354-dbc7-4954-863a-15f8fd7ccba5',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQWJ1IERoYWJpIENvcm5pY2hlIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=fb9953a9-5d8b-4d29-9c35-84c47bb783ac&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Along Abu Dhabi’s iconic coastline, the project introduces two visionary proposals that merge architecture with nature to create a landmark destination. Designed to activate the corniche and provide a gathering point, the project draws on local marine ecosystems—mangroves and coral reefs—for its conceptual framework.",
        paragraph2: "Option 1 is inspired by the beautiful mangroves of Abu Dhabi, with clustered columns forming a “forest” beneath sweeping solar canopies. These structures create shaded spaces for dining, retail, and events, reinforcing a connection to the natural environment. The design invites visitors to immerse themselves in a layered experience where the mangrove structure becomes both functional and iconic.",
        paragraph3: "Option 2 explores the beauty of coral formations through a fluid, undulating 3-dimensional structure. Perforated, 3D-printed elements allow light to filter through, while the dynamic form houses key programs like a water amphitheater, viewing decks, and community spaces.",
        paragraph4: 'Both proposals reimagine the relationship between land and sea, transforming Abu Dhabi’s corniche into a vibrant, multi-use hub for culture, recreation, and connection.'
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=c2e3eb8b-f2d6-4d18-a4c1-7e82f70832c1&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=3e28ee68-d882-43a2-b764-62bb80b9ffb1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6356efa9-3a62-4185-b58e-0ff4f752d7e8&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e3721ec4-e2ac-4c3e-85eb-bb80cee1f535&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 85, 
    title: 'BATELCO HQ',  
    abbr: 'BTC', 
    image: "./ICON/BTC.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=5a95a8cb-80b3-4b53-83bf-789959c45173&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=17e31594-035d-429e-a3e8-1b3cc5e95c6d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2022,
    client: "BEYON",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'BAHRAIN',
    scale: 'XL', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/BTC.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/12f85ddc-32e6-48c8-9936-c7ab95fecdb5',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/6fa240a9-33b9-465a-83c8-68e575a3269d',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/7332ec19-eabd-49e8-abe2-9ca9a2b2e75e',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQmF0ZWxjbyBIUSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=0a9a81c4-0d3c-4931-acd4-8992e5d2ba4e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=d5108d94-bfd5-4c34-a6e6-f038b99c9d81&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=66a3dbc5-8a8f-4682-9808-10c5e2505eb9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=f3687fd6-fcbe-480c-979b-9f8fee44f94b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=13891e01-62d4-4afd-9f40-c5a2fc048d45&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e9990d70-a1e2-4aac-aeed-f5f22d97e186&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{
    id: 86, 
    title: 'THE FARM RAK',  
    abbr: 'FRM', 
    image: "./ICON/FRM.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=3af9e448-24a9-4356-a1a4-4d6fd6cf1dc7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=a8c8b0bb-83d0-4c19-bef9-208c913617b5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024,
    client: "PRIVATE",
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'S', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/FRM.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2001cc23-bfb2-486f-8678-5bad736cb8f3',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/98871d71-6a04-439b-a8d5-c72db800f06f',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/76d5b709-7beb-48dc-b901-4f2fbb14881f',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiU2hhd2thIEZhcm0iXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=72ed31b1-4e40-42c6-b191-bc0b3a97de48&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "The Valley House is a serene residential project nestled within a natural farm valley, seamlessly blending into its surrounding terrain. Designed as a retreat for a private client, the residence prioritizes integration with nature, allowing the architecture to harmonize with the rugged landscape.",
        paragraph2: "The home features a thoughtful program of multiple bedrooms, a family room, majlis, dining, kitchen, and expansive living areas, with an outdoor pool as its defining feature. The pool extends into the valley, merging with the natural rock formations and pathways that flow down through the terrain, reinforcing a seamless connection to the environment.",
        paragraph3: "Two distinct design options were proposed. Option 1 emphasizes horizontal planes, with cantilevered terraces and open spaces that celebrate panoramic views while minimizing visual impact. Its natural materials and soft earthy tones enhance the integration with the rocky surroundings. Option 2, on the other hand, introduces a more vertical composition, with articulated facades and stone cladding that anchor the house more prominently into the landscape. Both options offer unique takes on the interplay between nature and architecture, creating a luxurious yet grounded experience."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=76bf823e-2041-4abd-a3a8-32b37ebfec65&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=7c9748fe-53db-44fa-9805-f02443f48db2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6a25dc61-363e-4522-baf2-83b0d247cd2a&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=53f00141-2819-4354-a9bb-1faa41886894&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{
    id: 87, 
    title: 'RUA AL HARAM 2023',  
    abbr: 'RUH2', 
    image: "./ICON/RUH2.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=21cf90dd-d461-4d6d-be65-3cab70ef8fb5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=2be6ff00-8c45-485e-83d2-51b755ca0025&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023,
    client: "PIF ",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'PAST', 
    hoverImage: "./hover/RUH2.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a0bfae00-a0f7-4032-86cf-3952554c29d0',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a2da0d1f-7a8a-4b32-aa06-c480ebfb5174',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2bec38f8-91bc-4a64-9e63-d5f0d242f0ae',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUnVhIEFsLUhhcmFtIDIuMCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a1f897a9-3737-4568-b77a-02f35c3bc91c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Rua AlHaram is a large-scale development in one of the holiest sites, Makkah, Saudi Arabia, designed to elevate the spiritual experience of pilgrims and visitors. At the heart of the masterplan is a focus on maximizing views towards the Kaaba, achieved through a carefully crafted geometry that increases the frontage by 58%. Outdoor prayer spaces have been expanded by 200%, far exceeding the brief requirements, creating a public realm that seamlessly blends spirituality with accessibility and comfort.",
        paragraph2: "The masterplan introduces the innovative Makkah Highline, a unique transport system that enhances mobility and pedestrian flow. Coupled with urban escalators and walkways, the project prioritizes crowd management during peak seasons such as Hajj. The zoning strategy divides the development into five distinctive clusters, each with a unique character offering a combination of residential, hospitality, retail, and cultural assets, ensuring a holistic experience for visitors.",
        paragraph3: "Architecturally, the masterplan adopts the style of the Second Expansion of the Holy Mosque.  Traditional elements such as arches, decorative screens, and intricate textures are reinterpreted to reflect the city’s heritage.  A carefully curated material palette and thoughtful design language create a seamless transition from the Holy Mosque to its surroundings, celebrating Makkah’s history while embracing its future."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=1d58bfb5-5946-4004-a31a-dcf2a6cfd083&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ebf09d4c-e129-4831-9b78-41e5e7b7b2b1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6a5e671f-8903-44df-84a0-a637fe261c66&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=38971fe6-5a1d-466b-a995-22253a88ddbc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2b7abc21-b812-454e-a328-f6ef5cf2fd60&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{
    id: 88, 
    title: 'UUU',  
    abbr: 'UUU', 
    image: "./ICON/UUU.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=21cf90dd-d461-4d6d-be65-3cab70ef8fb5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=f7bdf60d-d5af-4f16-907b-790f677c67cf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2014,
    client: "PIF ",
    program: 'TRANSPORTATION', 
    typology: 'TRANSPORTATON', 
    location: 'ABU DHABI',
    scale: 'S', 
    epoch: 'PAST', 
    hoverImage: "./hover/UUU.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a0bfae00-a0f7-4032-86cf-3952554c29d0',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/a2da0d1f-7a8a-4b32-aa06-c480ebfb5174',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2bec38f8-91bc-4a64-9e63-d5f0d242f0ae',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUnVhIEFsLUhhcmFtIDIuMCJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a1f897a9-3737-4568-b77a-02f35c3bc91c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=1d58bfb5-5946-4004-a31a-dcf2a6cfd083&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ebf09d4c-e129-4831-9b78-41e5e7b7b2b1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6a5e671f-8903-44df-84a0-a637fe261c66&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=38971fe6-5a1d-466b-a995-22253a88ddbc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2b7abc21-b812-454e-a328-f6ef5cf2fd60&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{
    id: 89, 
    title: 'ABDUL LATIF JAMEEL CHQ',  
    abbr: 'ALJ', 
    image: "./ICON/ALJ.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c1db6f66-8502-4e9c-9500-e4ae5690fb18&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=c74f165c-a3a0-4035-90f4-36ad1e3a5f82&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2015,
    client: "ABDUL LATIF JAMEEL",
    program: 'OFFICE', 
    typology: 'OFFICE', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/ALJ.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/2944e00c-0586-4f95-8e39-f0f14b69ba74',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQWJkdWwgTGF0aWYgSmFtZWVsIENIUSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/c8d30fa2-c980-4a77-b958-efd1672556ce',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=549e81c0-b2ca-49e8-90d2-07dd1240418c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=e6db641a-db61-410d-a16e-599f88f55407&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=07901d1f-896d-4575-9ef9-61093973377e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{
    id: 90, 
    title: 'RETAIL MALL, MULTAN',  
    abbr: 'MUL', 
    image: "./ICON/MUL.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=bc767c44-e0cd-4dfa-9a39-3e08f4ad4161&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=539d4ff7-19ea-47fd-81a2-cf5ff907b6c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2018,
    client: "FAISAL ASGHAR ENTERPRISES (PVT) LIMITED",
    program: 'OTHERS', 
    typology: 'MALL', 
    location: 'PAKISTAN',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/MUL.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/64be8529-f7b3-40df-af37-b2c41ed9edf8',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmV0YWlsIE1hbGwgTXVsdGFuIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/d986433f-575e-49e7-92af-0a374f98b99b',
    animationLink: 'https://aedasme.egnyte.com/navigate/folder/7a524739-b84b-4244-a02c-b0ce94d58fa8',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmV0YWlsIE1hbGwgTXVsdGFuIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b2eaadb7-e81e-4cbf-8955-bb370617a0ab&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [        
        "https://aedasme.egnyte.com/opendocument.do?entryId=1e418fa6-747a-4741-9fa1-b90b02cc71fd&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=fe0b9f36-fe95-4ebe-8bce-5c0f5a2b1615&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=1ed07da3-15fe-47e2-8c63-58367f735cb1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0dcc425a-1102-4d75-8e34-0ac7a53d83c0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=f6cc6da2-0eb0-4d60-bf2c-d4c6c4ba1dfa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
    ]
},
{
    id: 91, 
    title: 'MODON SCHOOL',  
    abbr: 'SCH', 
    image: "./ICON/SCH.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a85a466c-ebd9-40cb-8790-cc985f74588e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=6091900c-0a55-4af9-9033-87de3cf94037&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2015,
    client: "MODON",
    program: 'OTHERS', 
    typology: 'SCHOOL', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/SCH.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/MODON%20School/Presentation',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/efbf958e-c362-421d-b03f-cbfa6bcb893d',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTU9ET04gU2Nob29sIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    threeDLink: 'https://aedasme.egnyte.com/navigate/file/90ffd3ab-5edb-450a-a9ac-72ccbb2bd9ef',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b15fe66f-8eee-47c2-9d06-76aed0f28fbb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=663513a0-be81-4b16-8c15-4b0364e27a84&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",    
        "https://aedasme.egnyte.com/opendocument.do?entryId=48a9bc7d-d86a-4428-8ed1-2ba3d8191468&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4e1ec66a-63d7-4e11-9e31-85e55400ad18&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=91d6f527-6de1-4b15-b52f-6f132e897b71&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 92, 
    title: 'NEOM SINDALAH ISLAND',  
    abbr: 'SND', 
    image: "./ICON/SND.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=bc060a12-13ed-4d24-bf7a-fa58e60b9db6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=d285afeb-34e4-45d4-a9bd-3bcb1ab66eec&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021,
    client: "NEOM",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/SND.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/7d9c8e50-6bf1-476d-b8f6-d505d4c38cd6',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/d82489a8-21f9-49c5-a9a4-eda45dd15fd2',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTkVPTSBTaW5kYWxhaCBJc2xhbmQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLlNLUCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',        
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=173e6adb-78cf-41e2-a1eb-53e1da2a037f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=8a13db7e-695f-4e3d-b81c-29ad3fa42429&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",    
        "https://aedasme.egnyte.com/opendocument.do?entryId=b6f702e1-721e-40bb-9da0-d9e25d633e96&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=979ba3d1-c125-4fca-a31a-cd80963fed55&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=f228ce31-70ff-45d9-810e-812b5330c9a5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=93e996aa-ee02-4155-a341-72312e4fbfc8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 93, 
    title: 'MAYAN YAS MARINA',  
    abbr: 'MYN', 
    image: "./ICON/MYN.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a093e275-71df-4504-bc2c-805c74081baf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=2502b981-191b-4b2b-a5cb-e92a6a72ea23&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2015,
    client: "ALDAR",
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'ABU DHABI',
    scale: 'M', 
    epoch: 'PRESENT', 
    tags: [
        'BUILT'
    ],
    hoverImage: "./hover/MYN.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/9b978884-0c33-4cbb-93ea-ed2f89100d59',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTWF5YW4gWWFzIE1hcmluYSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/2afc97f3-8e20-416d-be51-68a827842167',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/Mayan%20Yas%20Marina/Animation',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTkVPTSBTaW5kYWxhaCBJc2xhbmQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLlNLUCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=340b92aa-947a-4e20-a693-5b60c31c2e3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=435c1801-3a09-4a05-bc33-d494baa74331&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=c53444b4-dcd5-4230-8f46-83be6b4dd506&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",    
        "https://aedasme.egnyte.com/opendocument.do?entryId=b0baa31d-f63b-4c30-8eb3-1937d74d9b7e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=470781e1-9f81-4e52-bfbc-cd3415f989dd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=aa7c7c39-d219-4cae-a479-59c79b046e26&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 94, 
    title: 'SAHARA EAST TOWER',  
    abbr: 'SAH', 
    image: "./ICON/SAH.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=fddd9a43-01c5-416d-97f8-8600ce6a1b86&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=42b11b52-b5f3-491b-8b95-d2e36bd9e549&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2019,
    client: "AL NAHDA REAL ESTATE TR. CO. LLC",
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'SHARJAH',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/SAH.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/93d77b50-8dc6-49a0-ad4b-c0ac4dfd79c8',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/87e3eaef-6248-414f-9b6e-2dd0e7f9aa07',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b48e1472-42a4-456a-8699-1e0b875e5c34&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=4dafd175-e871-44ef-960c-4c275ad185fd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=22711c2e-0e1b-406e-b4ec-5cf1c1038c0e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true" 
    ]
},
{
    id: 95, 
    title: 'RAS EL HEKMA VMP EGYPT - CLIFF HOTEL',  
    abbr: 'RCH', 
    image: "./ICON/RCH.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=5e28ccc4-6813-428b-9192-f2c19db9d31c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=48e646d1-c952-4268-86bf-214c1015f432&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024,
    client: "MODON",
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'PAST', 
    hoverImage: "./hover/RCH.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/77413b89-f2c5-4517-a322-70c09224e6ce',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/a6266285-ddbb-4cd8-a196-70991b1fedb5',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFzIEVsIEhla21hIENsaWZmIEhvdGVsIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=73d2108b-912d-4344-99a5-685b7f2d05c5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=4c136242-c1f1-4146-9e58-797cf6daf07e&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=c8c0a57b-4325-4581-878a-819243aef97b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5c494f91-07b6-4cee-a7b9-bcb4a34d8268&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2be13c6f-1972-4305-94b3-d15f2d80dac3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 96, 
    title: 'RAS EL HEKMA EAST BEACH HOTEL',  
    abbr: 'REB', 
    image: "./ICON/REB.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=71d7b6ed-4bfc-40e8-9c3d-1f191c7446d9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=6d0a2c9c-77b7-4103-967f-f8df2d0966eb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024,
    client: "MODON",
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'PAST', 
    hoverImage: "./hover/REB.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/Ras%20El%20Hekma/Presentation/Ras%20Al%20Hekma%20East%20Beach%20Hotel',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFzIEVsIEhla21hIEVhc3QgQmVhY2ggSG90ZWwiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/8600e63f-d19d-498b-a471-df4bbfc4b28d',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFzIEVsIEhla21hIEVhc3QgQmVhY2ggSG90ZWwiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a53decf7-2af1-491f-8e80-d2c5dc5f0141&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=1d39722d-f848-489f-b8ef-1a4219ba3ae3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=353e35a2-a62e-447c-aefd-99d7249866c2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=d6c3ea52-a9a2-410b-a937-be9f5a9fa7e0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=57170d04-0625-44de-bfbc-bb9058b794c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2be13c6f-1972-4305-94b3-d15f2d80dac3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{
    id: 97, 
    title: 'LULU ISLAND',  
    abbr: 'LUL', 
    image: "./ICON/LUL.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=22177da4-3e52-4ea7-b3df-ef8b50e7b50f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=044871d8-408d-413b-85df-9c00831ebca7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2022,
    client: "MODON",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'ABU DHABI',
    scale: 'L', 
    epoch: 'PAST', 
    hoverImage: "./hover/LUL.png",
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTW9kb24gTHVsdSBJc2xhbmQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLkRXRyJdfV0%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c382bb53-1493-4e40-83fe-466fd068b0ba',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiTW9kb24gTHVsdSBJc2xhbmQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLlNLUCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=695b0483-f259-4d2c-9242-31907a6a699f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=dfed923b-c550-488e-bfd5-be6cbace298d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ca79bb9a-261b-4228-9aff-9ffabc8d13f8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=20edae9b-3b6a-40d2-8d8c-c238e8027a54&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=89aea622-4bf9-47eb-b494-f6bfcb7b6808&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 98, 
    title: 'RAS EL HEKMA - AL QASR RESORT',  
    abbr: 'RAQ', 
    image: "./ICON/RAQ.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2e244288-9b5a-4c3e-bd83-4997efc18474&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=1129ef33-fb5f-4b87-ad25-b0b0feb105fa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024,
    client: "MODON",
    program: 'HOSPITALITY', 
    typology: 'HOSPITALITY', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'M', 
    epoch: 'PAST', 
    hoverImage: "./hover/RAQ.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/338baf6f-74de-422c-9781-df6111026729',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFzIEVsIEhFa21hIEFsIFFhc3IgUmVzb3J0Il19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/361c41c0-979e-464b-99df-8b305b6f446e',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFzIEVsIEhFa21hIEFsIFFhc3IgUmVzb3J0Il19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7d33493f-0611-414e-a706-184120741d3d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Al Qasr Resort is a harmonious blend of Mediterranean elegance and coastal charm, designed to blur the boundaries between indoor and outdoor living. Inspired by the Mediterranean villa, the resort integrates the natural topography with terraces that step down towards the sea, offering uninterrupted views and seamless connections to nature. At its heart lies a grand courtyard reminiscent of a traditional riad, leading visitors through a journey of terraces, gardens, and serene landscapes that culminate at the water's edge.",
        paragraph2: "The design features luxurious amenities, including sea pools, a submarine cove, and a dock, creating spaces for both relaxation and recreation. Thoughtfully planned, the resort incorporates spaces for social and private experiences, with a focus on versatility. A paddle court and event area add to the resort’s multifaceted offerings, making it a destination for all occasions.",
        paragraph3: "With two operational modes, Al Qasr adapts to varying needs. The presidential suite mode offers 20 rooms in a private, exclusive setup, featuring separate formal and social wings for unmatched luxury. Alternatively, the inventory mode provides flexible configurations with up to 24 rooms, ensuring adaptability for both personal and event-driven stays."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=4f8f514b-6516-439d-8ff8-723d9f2cc467&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=183aa1d1-deb3-4efe-9527-e4cf6e68d8cb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=77b738f3-0068-4dbc-bbb5-0dcf0e4cbc27&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=dfde90ea-4cf1-4349-b238-ae5a3b75885d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 99, 
    title: 'BUSINESS BAY LANDMARK WATERFRONT (BAY POINT)',  
    abbr: 'BBW', 
    image: "./ICON/BBW.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=79355a10-86f3-4a00-a2ca-f006ba0674d9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=28823401-6b66-4675-8019-fac68a4b7b06&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2017,
    client: "DUBAI PROPERTIES",
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    scale: 'M', 
    epoch: 'PRESENT', 
    tags: [
        'BAY POINT'
    ],
    hoverImage: "./hover/BBW.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/e7930663-8865-4db1-86a8-617a402141b0',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/75d42810-f50b-4427-b7d2-6325eddad63e',
    animationLink: 'https://aedasme.egnyte.com/navigate/file/54cfd122-a01d-4543-9182-80b89470bb3f',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiQnVzaW5lc3MgQmF5IExhbmRtYXJrIFdhdGVyZnJvbnQiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiM0QiXX1d',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=86575fce-5356-4418-b5be-09f28753424f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=a9ca2027-399b-4b42-8ff9-0f254cb07f84&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ad207ebb-7b15-4e3a-bb25-85825b5f11dc&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=7d45914e-0ce6-4c73-9870-0cb8ffd29b87&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=854b4de5-744c-4d7d-9412-583529d65e7b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=a0d3e08d-a4b8-4665-9fc7-2b70cf69d91f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{
    id: 100, 
    title: 'WAREHOUSES IN THE MINA ZAYED, ABU DHABI',  
    abbr: 'WMZ', 
    image: "./ICON/WMZ.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ffd43956-d712-41e4-926e-da69d5853117&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=59352469-2064-4491-be4c-fb993b80d12f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2018,
    client: "FISHERMAN'S COVE HOTEL LIMITED",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'ABU DHABI',
    scale: 'L', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/WMZ.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/6aa69b0e-f391-4793-854d-8628272a38ed',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/fe4fc02c-f7de-4bf5-9ac6-84ab0c633a74',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=391bf692-79d7-4ad0-a32d-7a917edccc69&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=b71cb35a-92b3-45f9-83ec-d71cd4e431de&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=73bdd569-c532-40b8-a094-be16b7baf1f0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=6e305129-d167-43ac-a6f9-5c64ef2ae1bd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
    ]
},

{
    id: 101, 
    title: 'GOA MANSIONS',  
    abbr: 'GOM', 
    image: "./ICON/GOM.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f303bfb9-8e73-43d1-ae70-6b9f7a7dc258&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=503c7b84-8514-4636-841d-db48f51f64fb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021,
    client: "NEOM",
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'S', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/GOM.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/9bfe57eb-9739-4d41-b78c-4079a273266c',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/3db35b8e-be54-499e-a001-3528f4fa92a9',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/c9abd43c-0612-492d-bf0b-5864ba193506',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2698f583-8780-4da2-b05f-5251aac04313&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=7299d2ce-006e-4612-8eaf-3288c22be82e&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9c263d13-1328-4a56-b573-60803ddded92&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=dc042d9d-dd39-4e8c-aedc-4f06b6d6caf3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0a11e98a-d4af-4175-8cb5-5da8432aaaaf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=0d0bc191-ff65-4298-98de-478fe92bde1e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=bcce37d4-1f9a-4f9a-a6b1-1d9e16ba9835&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=fc6c6a86-b852-4096-a3f7-a49d8a4fb555&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},
{
    id: 102, 
    title: 'GOA STAFF VILLAGE',  
    abbr: 'GOS', 
    image: "./ICON/GOS.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=687a2c68-b44f-4ea0-bdc5-cf67dd2d8f38&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=88de6dd3-2767-4743-bf47-3717e08e7eb5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2021,
    client: "NEOM",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'L', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/GOS.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/1ad22d50-ac6a-4d31-be86-cea1ac909221',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/folder/cf077815-0cfe-4cc7-9287-38ce7d9c312b',
    animationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/722486ba-f7e0-4d2a-9ab5-940ce13a08ae',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR09BIFN0YWZmIFZpbGxhZ2UiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLlNLUCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        animation: 'https://aedasme.egnyte.com/opendocument.do?entryId=02f7a926-55fc-429b-969c-6365bdc51f59&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=e3ffb949-7b7f-44a4-9196-b1ec74a5525e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=d9a44d42-b2ec-4760-b733-e8c701e6adf9&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=5d8c79aa-9408-455a-8d46-1c3a1f346e13&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=236b9d06-0339-4ae2-a287-82fc409b2079&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=ecfb0bc6-f9dd-4948-b9b9-d85ae71fa02c&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 103, 
    title: 'RAS EL HEKMA VMP EGYPT - ALGARVE & WEST COAST CANALS',  
    abbr: 'RAW', 
    image: "./ICON/RAW.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=06d782bb-65fc-4b58-ba8a-518bbf3aa409&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=76c0bcba-d077-48f8-8846-7ce0e93b84fa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024,
    client: "MODON",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'KSA, SAUDI ARABIA',
    scale: 'XL', 
    epoch: 'PAST', 
    hoverImage: "./hover/RAW.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFzIEVsIEhla21hIEFsZ2FydmUiLCJSYXMgRWwgSGVrbWEgV2VzdCBDb2FzdCBDYW5hbHMiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZGF0YSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUHJlc2VudGF0aW9uIiwiUmVwb3J0Il19XQ%3D%3D',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/files/1/Shared/Design%20Index/7.%20Project%20Media/Ras%20El%20Hekma/Visuals/Ras%20El%20Hekma%20Algarve%20%26%20West%20Coast%20Canals',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiUmFzIEVsIEhla21hIFdlc3QgQ29hc3QgQ2FuYWxzIiwiUmFzIEVsIEhla21hIEFsZ2FydmUiXX0seyJuYW1lc3BhY2UiOiJsaWJyYXJ5IHJlc291cmNlIiwia2V5IjoiZmlsdGUgdHlwZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiLlNLUCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f0df7a1e-392f-42d5-9b98-c632ff945b04&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=695a881a-6357-4877-9d97-338a3691ece1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=77bd7779-ce89-4214-9229-cd7412861464&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=f535a23d-013a-43b9-91b1-e211c58d96e4&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9d55db0b-6725-4ad7-8afb-f9e0863b1d80&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=eeea47d9-038d-478a-a14a-1c1a6b926f29&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 104, 
    title: 'KHOR SAADIYAT THEATER MARINA',  
    abbr: 'KTM', 
    image: "./ICON/KTM.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=aa414407-ca8d-4083-a6db-9939844c9ad3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=722230c7-8ddd-4755-937e-13d5eec83d39&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2024,
    client: "MODON",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'ABU DHABI',
    scale: 'L', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/KTM.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/eb146eae-7223-48b2-8f21-e9be87589fab',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/f1c62b3c-086e-4523-ae20-29496cd5543c',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiS2hvciBTYWFkaXlhdCBUaGVhdGVyIERpc3RyaWN0IE1hcmluYSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuU0tQIl19XQ%3D%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=5916c642-f968-4ed2-af7b-e2e0c440103a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Khor Saadiyat Theater District Marina brings a transformative vision to waterfront living, merging the energy of artistic expression with the tranquility of seaside spaces. The district thrives as a creative hub by day, offering vibrant plazas with stunning murals, boutique shopping, and alfresco dining. By night, it comes alive with performance art, turning the waterfront into a captivating stage for culture and entertainment.",
        paragraph2: "The masterplan presents two pathways to this vision. The T Scheme connects the marina's north and south with a direct line to the iconic Zayed Museum, encouraging a seamless cultural narrative. Meanwhile, the Avenue option forms a central corridor guiding visitors from the Saadiyat Cultural District to the House of Performing Arts, inviting them to explore the district’s rich tapestry of art and design. Both schemes are anchored by a climate-controlled pedestrian canopy, ensuring a comfortable and shaded experience in all seasons, enhancing the district's year-round appeal.",
        paragraph3: "In addition to its artistic core, the district features Waterfront Heights, a culinary and retail haven offering panoramic ocean views, and The Courtyards, a harmonious blend of residential and office spaces. Together, these elements create a vibrant, inclusive community where culture, commerce, and nature converge."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=660bd4cb-b2e0-40ca-a0d3-3dac4fa47ba2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9c6503f4-5ea0-4572-95e9-aa18ed04c2c9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=e507236b-bc6e-4975-b9cb-da23f1335606&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 105, 
    title: 'KHOR SAADIYAT THEATER DISTRICT',  
    abbr: 'KTD', 
    image: "./ICON/KTD.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=06f31ad9-05fc-4a81-a63c-865b130bfbb5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=9a4afa0c-8af7-4717-9b33-2dc14b1007a3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2023,
    client: "MODON",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'ABU DHABI',
    scale: 'L', 
    epoch: 'FUTURE', 
    hoverImage: "./hover/KTD.png",
    visualLink: 'https://aedasme.egnyte.com/navigate/folder/26a27d8d-60db-4dec-9464-905f71aa8cb4',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiS2hvciBTYWFkaXlhdCBUaGVhdGVyIERpc3RyaWN0Il19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=61ad3900-0b9b-4eed-aec9-c7836786c393&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=26a79e9a-a4a2-49f2-a150-6f8033199ddf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=37bc6a2d-76bc-4c03-8b3b-3fc1dbb2ca2e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 106, 
    title: 'KHOR SAADIYAT MASTERPLAN',  
    abbr: 'KSM', 
    image: "./ICON/KSM.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=748c336c-02d2-4285-90d1-e9dce4720870&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=38b7e39f-718b-48e9-a5ae-e9ea759c5cac&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "MODON",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'ABU DHABI',
    scale: 'XL', 
    epoch: 'PAST', 
    hoverImage: "./hover/KSM.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/e7ee05a6-8181-43db-a84e-8e428626fe2c',
    visualLink: 'https://aedasme.egnyte.com/navigate/folder/ef452a7d-612c-4f8e-9161-6daa9bd48cf4',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiS2hvciBBbCBTYWFkaXlhdCBNYXN0ZXJwbGFuIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImRhdGEiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIjNEIl19XQ%3D%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=3daebd38-1b72-47a1-82be-d5d12ba72060&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=148dc21d-c2b7-454e-b5f2-84f09b4f9282&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=a0208520-aa4d-4a22-9ffc-d985975e4408&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=2bc6d91e-ab01-4c61-95f4-4028b15611f7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=4fe2a332-cda7-4a52-920e-f502cc0bef62&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=a4f6d506-fe41-49ca-a5c3-306c110f0fe3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
},

{
    id: 107, 
    title: 'GEMINI SPLENDOR',  
    abbr: 'GEM', 
    image: "./ICON/GEM.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=dc6e14b3-9103-489c-9b71-75733cbd497e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=18937a7f-6ac2-4172-a59a-cbe7b4d96e9e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2015,
    client: "GEMINI PROPERTY DEVELOPERS",
    program: 'RESIDENTIAL', 
    typology: 'RESIDENTIAL', 
    location: 'DUBAI, UAE',
    tags: [
        'BUILT'
    ],
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/GEM.png",
    presentationLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/02dce027-3ed5-4f06-9be1-eca1aefec5ec',
    visualLink: 'https://aedasme.egnyte.com/app/index.do#storage/file/bc6851d1-d4aa-4b40-ad75-b688b4325520',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR2VtaW5pIFNwbGVuZG9yIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5EV0ciXX1d',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=all&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiR2VtaW5pIFNwbGVuZG9yIl19LHsibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6ImZpbHRlIHR5cGUiLCJvcGVyYXRvciI6IklOIiwidmFsdWVzIjpbIi5TS1AiXX1d',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=5abd06a7-6e0a-4914-8594-4f2bbfa3314c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=d699fd22-604f-4b22-b5b9-f53ae01c06fd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=b386a3f0-f865-4005-b3c0-5471c922293e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=bb11b87e-05d3-4839-87c1-0a887125c310&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
    ]
},

{
    id: 108, 
    title: 'FOOTBALL CITY DUBAI',  
    abbr: 'FBC', 
    image: "./ICON/FBC.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=03a21d4b-bc72-4434-b1ca-c166c77bcb6e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=39b7a18b-be6c-4d8b-b34f-2271eababb9b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2020,
    client: "FOOTBALL",
    program: 'MASTERPLAN', 
    typology: 'MASTERPLAN', 
    location: 'DUBAI, UAE',
    scale: 'XL', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/FBC.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/47400822-05c8-4865-924f-4f2267ce9a8a',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/45f64f88-fc96-4cc8-93e2-a7da3ff65a45',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=08cbefc0-afe4-4abf-91dc-0f057352cfdd&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=37c0012f-a7b3-4c48-9544-b055e6da9e86&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=9c9cce78-2efa-4d6d-be59-70c0c647b870&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=f90ef380-742a-400f-a2d8-97c0451c4078&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
    ]
},

{
    id: 109, 
    title: 'JAV PHASE 2  MOSQUE',  
    abbr: 'J2M', 
    image: "./ICON/J2M.svg",
    coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7e1e93f6-72dd-42a3-b8e6-6e9f716ae65c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=47eea0b1-d3fd-4a3c-8b5e-ffd9da32bb85&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
    year: 2017,
    client: "WASL",
    program: 'OTHERS', 
    typology: 'MOSQUE', 
    location: 'DUBAI, UAE',
    scale: 'M', 
    epoch: 'PRESENT', 
    hoverImage: "./hover/J2M.png",
    presentationLink: 'https://aedasme.egnyte.com/navigate/file/815e77c3-477d-4365-8f93-4a5422c7b944',
    drawingLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSkFWIFBoYXNlIDIgIE1vc3F1ZSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJmaWx0ZSB0eXBlIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIuRFdHIl19XQ%3D%3D',
    visualLink: 'https://aedasme.egnyte.com/navigate/file/b0b808f0-87ee-466a-830b-e99784d91873',
    threeDLink: 'https://aedasme.egnyte.com/app/index.do#storage/search/?type=file&location=%2FShared%2FDesign%20Index&metadata=W3sibmFtZXNwYWNlIjoibGlicmFyeSByZXNvdXJjZSIsImtleSI6InByb2plY3QgbmFtZSIsIm9wZXJhdG9yIjoiSU4iLCJ2YWx1ZXMiOlsiSkFWIFBoYXNlIDIgIE1vc3F1ZSJdfSx7Im5hbWVzcGFjZSI6ImxpYnJhcnkgcmVzb3VyY2UiLCJrZXkiOiJkYXRhIiwib3BlcmF0b3IiOiJJTiIsInZhbHVlcyI6WyIzRCJdfV0%3D',
    linkImages: {
        presentation: 'https://aedasme.egnyte.com/opendocument.do?entryId=f339273d-0467-474d-a996-4e8b7360dc3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        visual: 'https://aedasme.egnyte.com/opendocument.do?entryId=d349d403-6b9e-474d-a14a-e224b80bd9e8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        drawing: 'https://aedasme.egnyte.com/opendocument.do?entryId=d235bc93-b53a-4741-9b80-56a46fdc50f2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',  
        threeD: 'https://aedasme.egnyte.com/opendocument.do?entryId=73b9cc45-a7c6-422e-aa36-01b3744bb3f1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true'
    },
    descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=d8c4d3e1-aeed-4117-911b-a442c3500f9e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
    description: {
        paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
        paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
        paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
    },
    teamMembers: [
        "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",
    ],
    galleryImages: [    
        "https://aedasme.egnyte.com/opendocument.do?entryId=d443058b-0ea1-465a-be3d-1159c9712304&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=32eb4b26-e75a-4dd8-a952-3ded8805c543&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=57ca443f-425a-4d8d-9975-5c1cb3441262&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
        "https://aedasme.egnyte.com/opendocument.do?entryId=100ecf67-a41d-48dc-a8e8-c29a2dfaf320&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
    ]
}


];

const filterConfigs = {
    CHRONOLOGICAL: {
        headers: Array.from({ length: 11 }, (_, i) => (2014 + i).toString()),
        getHeader: project => project.year.toString()
    },
    EPOCH: {
        headers: ['PAST', 'PRESENT', 'FUTURE'],
        getHeader: project => project.epoch
    },
    ALPHABETICAL: {
        headers: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'XYZ#'],
        getHeader: project => {
            const firstChar = project.abbr[0];
            // Check if it's a number or X, Y, Z
            if (/^\d/.test(firstChar) || ['X', 'Y', 'Z'].includes(firstChar)) {
                return 'XYZ#';
            }
            return firstChar;
        }
    },
    PROGRAMMATIC: {
        headers: ['MASTERPLAN', 'HOSPITALITY', 'OTHERS', 'TRANSPORTATION', 'RESIDENTIAL', 'OFFICE'],
        getHeader: project => project.program
    },
    SCALE: {
        headers: ['S', 'M', 'L', 'XL'],
        getHeader: project => project.scale
    },
    LOCATION: {
        headers: [...new Set(projects.map(p => p.location))],
        getHeader: project => project.location
    }
};

function getColumnWidth(totalHeaders) {
    const minWidth = 60;
    const maxWidth = 100;
    const padding = 64;
    const availableWidth = window.innerWidth - padding;
    const calculatedWidth = Math.floor(availableWidth / totalHeaders);
    
    return Math.min(Math.max(calculatedWidth, minWidth), maxWidth);
}

function getProjectKey(project, filter) {
    return `project-${project.id}-${filterConfigs[filter].getHeader(project)}`;
}// Global state for toggle
let showHoverImages = false;

// Add styles for toggle switch
const style = document.createElement('style');
style.textContent = `
    // Existing styles remain the same
`;
document.head.appendChild(style);

// Create toggle switch elements
function createToggleSwitch() {
    const toggleSwitch = document.createElement('div');
    toggleSwitch.className = 'toggle-switch';

    const labelIcon = document.createElement('span');
    labelIcon.className = 'toggle-label';

    const labelHover = document.createElement('span');
    labelHover.className = 'toggle-label';

    const track = document.createElement('div');
    track.className = 'toggle-track';

    const handle = document.createElement('div');
    handle.className = 'toggle-handle';

    const icons = document.createElement('div');
    icons.className = 'toggle-icons';

    // Create mini icon SVGs
    const iconSvg = `
        <svg class="toggle-icon icon" viewBox="0 0 24 24">
        </svg>
    `;

    const hoverSvg = `
        <svg class="toggle-icon hover" viewBox="0 0 24 24">
        </svg>
    `;

    icons.innerHTML = iconSvg + hoverSvg;

    // Assemble the toggle
    track.appendChild(handle);
    track.appendChild(icons);
    toggleSwitch.appendChild(labelIcon);
    toggleSwitch.appendChild(track);
    toggleSwitch.appendChild(labelHover);

    return { toggleSwitch, track };
}

// Project icon creation function
function createProjectIcon(project, filter) {
    const projectIcon = document.createElement('div');
    projectIcon.className = 'project-icon';
    projectIcon.title = project.title;
    projectIcon.dataset.layoutId = `project-${project.id}`;
    projectIcon.style.position = 'relative';
    
    // Create and set up the main image
    const img = document.createElement('img');
    img.src = showHoverImages ? project.hoverImage : project.imageUrl;
    img.alt = project.title;
    img.className = 'project-icon-image';
    img.loading = 'lazy';
    
    // Create the hover image
    const hoverImg = document.createElement('img');
    hoverImg.src = showHoverImages ? project.imageUrl : project.hoverImage;
    hoverImg.alt = project.title;
    hoverImg.className = 'project-icon-hover';
    hoverImg.loading = 'lazy';
    
    // Error handling
    img.onerror = () => {
        img.src = '/placeholder.png';
        console.warn(`Failed to load image for project: ${project.title}`);
    };
    
    hoverImg.onerror = () => {
        hoverImg.src = project.imageUrl || '/placeholder.png';
    };
    
    projectIcon.appendChild(img);
    projectIcon.appendChild(hoverImg);

    // Add hover event listeners
    projectIcon.addEventListener('mouseenter', () => {
        document.body.style.zIndex = '1';
        projectIcon.style.zIndex = '9999';
    });

    projectIcon.addEventListener('mouseleave', () => {
        projectIcon.style.zIndex = '1';
    });
    
    return projectIcon;
}

// Toggle functionality
function toggleProjectIcons(track) {
    showHoverImages = !showHoverImages;
    track.classList.toggle('active');
    
    // Get current active filter
    const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
    
    // Update grid with new images
    updateGrid(activeFilter);
}

// Initialize toggle switch
document.addEventListener('DOMContentLoaded', () => {
    const { toggleSwitch, track } = createToggleSwitch();
    document.body.appendChild(toggleSwitch);
    track.addEventListener('click', () => toggleProjectIcons(track));
});
function hideSearch() {
    const searchTab = document.querySelector('.search-tab');
    if (searchTab) {
        searchTab.style.display = 'none';
    }
}

function showSearch() {
    const searchTab = document.querySelector('.search-tab');
    if (searchTab) {
        searchTab.style.display = 'flex';
    }
}
function openProjectModal(project) {
    const modal = document.getElementById('projectModal');
    hideSearch();

    // Clear all existing content first
    const coverImage = document.getElementById('projectCoverImage');
    const iconImage = document.getElementById('projectIconImage');
    const descriptionImage = document.getElementById('projectDescriptionImage');
    const galleryContainer = document.querySelector('.gallery-container');
    const linksContainer = document.querySelector('.project-links');

    // Clear all images and containers
    coverImage.src = '';
    iconImage.src = '';
    if (descriptionImage) descriptionImage.src = '';
    galleryContainer.innerHTML = '';
    linksContainer.innerHTML = '';

    // Force display and scroll reset
    modal.style.display = 'block';
    modal.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant'
    });
    
    window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant'
    });
    
    modal.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Set project details (text content first)
    document.getElementById('projectTitle').textContent = project.title;
    document.getElementById('projectLocation').textContent = project.location || 'N/A';
    document.getElementById('projectDate').textContent = project.year || 'N/A';
    document.getElementById('projectClientValue').textContent = project.client || 'N/A';
    document.getElementById('projectTypologyValue').textContent = project.typology || 'N/A';
    document.getElementById('teamMembers').textContent = project.teamMembers || 'Team members information not available';

    // Set description paragraphs
document.getElementById('descriptionParagraph1').textContent = project.description?.paragraph1 || 
"The project's first conceptual framework emphasizes innovative design solutions that respond to both environmental and social contexts.";

document.getElementById('descriptionParagraph2').textContent = project.description?.paragraph2 || 
"Our approach integrates sustainable practices with modern functionality, resulting in spaces that are both environmentally conscious and aesthetically striking.";

document.getElementById('descriptionParagraph3').textContent = project.description?.paragraph3 || 
"The final outcome represents a harmonious blend of form and function, where each design element serves a purpose while contributing to the overall architectural narrative.";

// Handle paragraph 4
const paragraph4Element = document.getElementById('descriptionParagraph4');
if (project.description?.paragraph4) {
paragraph4Element.textContent = project.description.paragraph4;
paragraph4Element.style.display = 'block';
} else {
paragraph4Element.style.display = 'none';
}

// Handle paragraph 5
const paragraph5Element = document.getElementById('descriptionParagraph5');
if (project.description?.paragraph5) {
paragraph5Element.textContent = project.description.paragraph5;
paragraph5Element.style.display = 'block';
} else {
paragraph5Element.style.display = 'none';
}
    // Now set images (after text content is set)
    coverImage.src = project.coverImage;
    iconImage.src = project.imageUrl;
    if (descriptionImage && project.descriptionImage) {
        descriptionImage.src = project.descriptionImage;
    }

    // Add project links
    const projectLinks = [
        { href: project.threeDLink, src: project.linkImages?.threeD, alt: '3D View' },
        { href: project.animationLink, src: project.linkImages?.animation, alt: 'Animation' },
        { href: project.drawingLink, src: project.linkImages?.drawing, alt: 'Drawings' },
        { href: project.visualLink, src: project.linkImages?.visual, alt: 'Visuals' },
        { href: project.presentationLink, src: project.linkImages?.presentation, alt: 'Presentation' }
    ];

    projectLinks.filter(link => link.href && link.src).forEach(link => {
        const anchor = document.createElement('a');
        anchor.href = link.href;
        anchor.target = '_blank';

        const image = document.createElement('img');
        image.src = link.src;
        image.alt = link.alt;

        anchor.appendChild(image);
        linksContainer.appendChild(anchor);
    });

    // Add Gallery Images
    if (project.galleryImages && Array.isArray(project.galleryImages)) {
        project.galleryImages.forEach(imageUrl => {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'gallery-image-container';

            const image = document.createElement('img');
            image.src = imageUrl;
            image.className = 'gallery-image';
            image.alt = 'Project Gallery Image';

            imageContainer.appendChild(image);
            galleryContainer.appendChild(imageContainer);
        });
    }

    // Modal close handlers
const closeButton = modal.querySelector('.close-modal');
closeButton.innerHTML = `
    <svg width="40" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter">
        <line x1="20" y1="6" x2="6" y2="20"></line>
        <line x1="6" y1="6" x2="20" y2="20"></line>
    </svg>
`;
    const homeButton = modal.querySelector('.home-modal');
    const oldKeydownHandler = modal.keydownHandler;
    if (oldKeydownHandler) {
        document.removeEventListener('keydown', oldKeydownHandler);
    }

    const closeModalAndReset = () => {
        const modal = document.getElementById('projectModal');
        if (!modal) return;
        
        try {
            // Restore search value from modal's dataset
            if (modal.dataset.searchValue) {
                mainSearchInput.value = modal.dataset.searchValue;
                // Trigger search update
                const event = new Event('input');
                mainSearchInput.dispatchEvent(event);
            }
            
            // Show search
            showSearch();
            
            // Reset modal and scroll positions
            modal.style.display = 'none';
            modal.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            document.body.style.overflow = 'auto';
            
            // Clear modal's stored data
            delete modal.dataset.searchValue;
            delete modal.dataset.currentProject;
        } catch (error) {
            console.error('Error closing modal:', error);
            // Ensure modal is hidden and body scroll is restored
            if (modal) modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    };
    closeButton.onclick = closeModalAndReset;
    homeButton.onclick = closeModalAndReset;

    // Add keyboard navigation for closing modal
    const keydownHandler = function(event) {
        if (event.key === 'Escape') {
            closeModalAndReset();
            document.removeEventListener('keydown', keydownHandler);
        }
    };
    modal.keydownHandler = keydownHandler;
    document.addEventListener('keydown', keydownHandler);

    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';

    // Add smooth scrolling after initial position is set
    setTimeout(() => {
        document.documentElement.style.scrollBehavior = 'smooth';
    }, 100);

    // Force one final scroll to top after a slight delay
    setTimeout(() => {
        modal.scrollTo({
            top: 0,
            left: 0,
            behavior: 'instant'
        });
    }, 50);
}

function closeProjectModal() {
    const modal = document.getElementById('projectModal');
    modal.style.display = 'none';
    showSearch();
    modal.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant'
    });
    window.scrollTo({
        top: 0,
        left: 0,
        behavior: 'instant'
    });
    modal.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    document.body.style.overflow = 'auto';
    document.documentElement.style.scrollBehavior = 'auto';
}

// Add event listeners
document.querySelector('.close-modal').addEventListener('click', closeProjectModal);

document.getElementById('projectGrid').addEventListener('click', event => {
    if (event.target.closest('.project-icon')) {
        const projectId = event.target.closest('.project-icon').dataset.layoutId.split('-')[1];
        const project = projects.find(p => p.id === parseInt(projectId, 10));
        openProjectModal(project);
    }
});


function updateGrid(activeFilter) {
    const grid = document.getElementById('projectGrid');
    const oldIcons = Array.from(grid.querySelectorAll('.project-icon'));
    const oldPositions = new Map();

    // Store old positions
    oldIcons.forEach(icon => {
        const rect = icon.getBoundingClientRect();
        oldPositions.set(icon.dataset.layoutId, {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        });
    });

    if (activeFilter === 'LOCATION') {
        grid.innerHTML = '';
        grid.style.width = '100%';
        grid.style.height = '80vh';
        grid.style.position = 'relative';
        grid.style.overflow = 'hidden';
        grid.style.margin = 'auto';
        grid.style.marginTop = '2rem';
    
        const { renderer, animate, resizeHandler } = createGlobe();
        grid.appendChild(renderer.domElement);
        animate();
        window.addEventListener('resize', resizeHandler);
        return;
    }

    // Reset styles for other views
    grid.style.width = '';
    grid.style.height = '';
    grid.style.position = '';
    grid.style.overflow = '';
    grid.style.margin = '';
    grid.style.marginTop = '';

    // Clear current grid content
    grid.innerHTML = '';

    if (activeFilter === 'EPOCH') {
        const epochs = ['PAST', 'PRESENT', 'FUTURE'];
        const programOrder = ['MASTERPLAN', 'HOSPITALITY', 'OTHERS', 'TRANSPORTATION', 'RESIDENTIAL', 'OFFICE'];
        const epochWidth = getColumnWidth(3) * 1.5;
    
        epochs.forEach((epoch, index) => {
            const epochSection = document.createElement('div');
            epochSection.className = 'epoch-category-section';
            epochSection.style.width = `${epochWidth}px`;
            
            // Adjust margins to create equal spacing
            if (epoch === 'PRESENT') {
                epochSection.style.margin = '0 20px'; // Equal margin on both sides
            } else if (epoch === 'PAST') {
                epochSection.style.margin = '0 25px 0 0'; // Right margin only
            } else if (epoch === 'FUTURE') {
                epochSection.style.margin = '0 0 0 49px'; // Left margin only
            }
    
            // Create columns container
            const columnsContainer = document.createElement('div');
            columnsContainer.className = 'epoch-category-columns';
            columnsContainer.style.display = 'flex';
            columnsContainer.style.justifyContent = 'space-between';
            columnsContainer.style.width = '100%';
            columnsContainer.style.marginBottom = '-0rem';
    
            // Adjust gap for PRESENT epoch
            if (epoch === 'PRESENT') {
                columnsContainer.style.gap = '34px',
                columnsContainer.style.justifyContent = 'center';
                columnsContainer.style.padding = '0 8px';

            }
    
            // Determine number of columns based on epoch
            const numColumns = epoch === 'PRESENT' ? 5 : 3;
    
            // Create columns
            const columns = [];
            for (let i = 0; i < numColumns; i++) {
                const column = document.createElement('div');
                column.className = 'epoch-category-column';
                
                // Adjust column width based on epoch
                if (epoch === 'PRESENT') {
                    column.style.width = `${(epochWidth / numColumns) - 12}px`;
                } else {
                    column.style.width = `${epochWidth / numColumns - 8}px`;
                }
                
                column.style.display = 'flex';
                column.style.flexDirection = 'column-reverse';
                column.style.gap = epoch === 'PRESENT' ? '7px' : '7px';
    
                columnsContainer.appendChild(column);
                columns.push(column);
            }
    
            // Filter and group projects by program
            const epochProjects = projects.filter(project => project.epoch === epoch);
            const projectsByProgram = {};
            programOrder.forEach(program => {
                projectsByProgram[program] = epochProjects.filter(project => project.program === program);
            });
    
            // Calculate total projects and rows needed
            const totalProjects = epochProjects.length;
            const numRows = Math.ceil(totalProjects / numColumns);
    
            // Create a 2D array for the grid (row-major order)
            const projectGrid = Array(numRows).fill(null).map(() => Array(numColumns).fill(null));
    
            // Fill the grid row by row, starting from the bottom
            let currentProgram = 0;
            let currentProgramProjects = projectsByProgram[programOrder[currentProgram]] || [];
    
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numColumns; col++) {
                    while (currentProgramProjects.length === 0 && currentProgram < programOrder.length - 1) {
                        currentProgram++;
                        currentProgramProjects = projectsByProgram[programOrder[currentProgram]] || [];
                    }
    
                    if (currentProgramProjects.length > 0) {
                        projectGrid[row][col] = currentProgramProjects.shift();
                    }
                }
            }
    
            // Create and append project icons based on the grid
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numColumns; col++) {
                    const project = projectGrid[row][col];
                    if (project) {
                        const projectIcon = createProjectIcon(project, activeFilter);
                        columns[col].appendChild(projectIcon);
                    }
                }
            }
    
            // Create epoch header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'header';
            headerDiv.textContent = epoch;
            headerDiv.style.width = '100%';
            headerDiv.style.textAlign = 'center';
    
            epochSection.appendChild(columnsContainer);
            epochSection.appendChild(headerDiv);
            grid.appendChild(epochSection);
        });
    }
    else if (activeFilter === 'CHRONOLOGICAL') {
        const programOrder = ['MASTERPLAN', 'HOSPITALITY', 'OTHERS', 'TRANSPORTATION', 'RESIDENTIAL', 'OFFICE'];
        const years = filterConfigs[activeFilter].headers;
        const yearWidth = getColumnWidth(years.length) * 1.2;
    
        years.forEach(year => {
            const yearSection = document.createElement('div');
            yearSection.className = 'year-category-section';
            yearSection.style.width = `${yearWidth}px`;
            yearSection.style.margin = '0 -11px'; // Add horizontal margin (8px is an example value)
            yearSection.style.display = 'flex';
            yearSection.style.flexDirection = 'column';
            yearSection.style.alignItems = 'center'; // Center all contents

    
            // Create columns container
            const columnsContainer = document.createElement('div');
            columnsContainer.className = 'year-category-columns';
            columnsContainer.style.display = 'flex';
            columnsContainer.style.justifyContent = 'center'; // Center the columns
            columnsContainer.style.gap = '8px'; // Add gap between columns
            columnsContainer.style.width = `${yearWidth * 0.8}px`; // Slightly narrower than section
            columnsContainer.style.marginBottom = '0rem'; // Add space between columns and header
    
            // Create two columns
            const columns = [];
            for (let i = 0; i < 2; i++) {
                const column = document.createElement('div');
                column.className = 'year-category-column';
                column.style.width = `${(yearWidth * 0.8) / 2 - 2}px`; // Account for gap
                column.style.display = 'flex';
                column.style.flexDirection = 'column-reverse';
                column.style.gap = '7px';
    
                columnsContainer.appendChild(column);
                columns.push(column);
            }
    
            // Create year header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'header';
            headerDiv.textContent = year;
            headerDiv.style.width = '100%';
            headerDiv.style.textAlign = 'center';
    
            // Filter and group projects by program
            const yearProjects = projects.filter(project => project.year.toString() === year);
            const projectsByProgram = {};
            programOrder.forEach(program => {
                projectsByProgram[program] = yearProjects.filter(project => project.program === program);
            });
    
            // Calculate how many rows we'll need
            const totalProjects = yearProjects.length;
            const numRows = Math.ceil(totalProjects / 2);
    
            // Create a 2D array to represent our grid (row-major order)
            const projectGrid = Array(numRows).fill(null).map(() => Array(2).fill(null));
    
            // Fill the grid row by row, starting from the bottom
            let currentProgram = 0;
            let currentProgramProjects = projectsByProgram[programOrder[currentProgram]] || [];
    
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < 2; col++) {
                    // If we've used all projects from current program, move to next program
                    while (currentProgramProjects.length === 0 && currentProgram < programOrder.length - 1) {
                        currentProgram++;
                        currentProgramProjects = projectsByProgram[programOrder[currentProgram]] || [];
                    }
    
                    if (currentProgramProjects.length > 0) {
                        projectGrid[row][col] = currentProgramProjects.shift();
                    }
                }
            }
    
            // Create and append project icons based on the grid
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < 2; col++) {
                    const project = projectGrid[row][col];
                    if (project) {
                        const projectIcon = createProjectIcon(project, activeFilter);
                        columns[col].appendChild(projectIcon);
                    }
                }
            }
    
            yearSection.appendChild(columnsContainer);
            yearSection.appendChild(headerDiv); // Header is now appended after the columns
            grid.appendChild(yearSection);
        });
    }
    else if (activeFilter === 'ALPHABETICAL') {
        const programOrder = ['MASTERPLAN', 'HOSPITALITY', 'OTHERS', 'TRANSPORTATION', 'RESIDENTIAL', 'OFFICE'];
        const letters = filterConfigs[activeFilter].headers;
        const letterWidth = getColumnWidth(letters.length);
    
        letters.forEach((letter, index) => {
            const letterSection = document.createElement('div');
            letterSection.className = 'letter-category-section';
            letterSection.dataset.letter = letter;
            
            // Adjust width for specific letters to prevent overlap
            if (letter === 'R' || letter === 'Q') {
                letterSection.style.width = `${letterWidth * 1.2}px`; // Make R and Q sections wider
            } else {
                letterSection.style.width = `${letterWidth}px`;
            }
            
            letterSection.style.position = 'relative';
            letterSection.style.display = 'flex';
            letterSection.style.flexDirection = 'column';
            letterSection.style.alignItems = 'center';
            letterSection.style.justifyContent = 'flex-end';
        
            // Handle margins based on adjacent letters
            const nextLetter = letters[index + 1];
            const prevLetter = letters[index - 1];
            
            if (letter === 'S') {
                letterSection.style.margin = '0 -5px 0 20px';
            } else if (letter === 'M') {
                letterSection.style.margin = '0 -5px';
            } else if (letter === 'R') {
                letterSection.style.margin = '0 13px'; // Add margin for R to separate from Q
            } else if (letter === 'Q') {
                letterSection.style.margin = '0 -13px 0 -15px'; // First number is top, second is right, third is bottom, fourth is left
            
            } else if (nextLetter === 'S' || nextLetter === 'M') {
                letterSection.style.margin = '0 20px 0 -7px';
            } else if (prevLetter === 'S' || prevLetter === 'M') {
                letterSection.style.margin = '0 -7px 0 15px';
            } else {
                letterSection.style.margin = '0 -7px';
            }
        
            // Get and sort projects for this letter
            const letterProjects = projects
                .filter(project => filterConfigs[activeFilter].getHeader(project) === letter)
                .sort((a, b) => programOrder.indexOf(a.program) - programOrder.indexOf(b.program));
        
            const columnsContainer = document.createElement('div');
            columnsContainer.className = 'letter-category-columns';
            columnsContainer.style.marginBottom = '-0.6rem';
            columnsContainer.style.position = 'relative';
            if (letterProjects.length > 9) {
                // Two-column layout for more than 9 projects
                columnsContainer.style.display = 'flex';
                columnsContainer.style.justifyContent = 'center';
                columnsContainer.style.gap = '35px';
                columnsContainer.style.width = `${letterWidth * 0.8}px`;
                columnsContainer.style.marginLeft = '-30px';
                columnsContainer.style.marginBottom = '0px';

                
                // Create two columns
                const leftColumn = document.createElement('div');
                const rightColumn = document.createElement('div');
                [leftColumn, rightColumn].forEach(column => {
                    column.style.width = `${(letterWidth * 0.8 / 2) - 6}px`;
                    column.style.display = 'flex';
                    column.style.flexDirection = 'column-reverse';
                    column.style.gap = '7px';
                    column.style.position = 'relative';
                });
    
                // Distribute projects between columns
                letterProjects.forEach((project, index) => {
                    const projectIcon = createProjectIcon(project, activeFilter);
                    projectIcon.style.position = 'relative';
                    projectIcon.style.pointerEvents = 'auto';
                    
                    if (index % 2 === 0) {
                        leftColumn.appendChild(projectIcon);
                    } else {
                        rightColumn.appendChild(projectIcon);
                    }
                });
    
                columnsContainer.appendChild(leftColumn);
                columnsContainer.appendChild(rightColumn);
            } else {
                // Single column layout for 9 or fewer projects
                columnsContainer.style.display = 'flex';
                columnsContainer.style.flexDirection = 'column';
                columnsContainer.style.width = '100%';
    
                const projectStack = document.createElement('div');
                projectStack.className = 'project-stack';
                projectStack.style.display = 'flex';
                projectStack.style.flexDirection = 'column-reverse';
                projectStack.style.gap = '7px';
                projectStack.style.width = '100%';
                projectStack.style.position = 'relative';
                projectStack.style.zIndex = 'auto';
    
                letterProjects.forEach(project => {
                    const projectIcon = createProjectIcon(project, activeFilter);
                    projectIcon.style.position = 'relative';
                    projectIcon.style.zIndex = '1';
                    projectIcon.style.pointerEvents = 'auto';
                    projectStack.appendChild(projectIcon);
                });
    
                columnsContainer.appendChild(projectStack);
            }
    
            // Add header
            const headerDiv = document.createElement('div');
            headerDiv.className = 'header';
            headerDiv.textContent = letter;
            headerDiv.style.width = '100%';
            headerDiv.style.textAlign = 'center';
    
            letterSection.appendChild(columnsContainer);
            letterSection.appendChild(headerDiv);
            grid.appendChild(letterSection);
        });
    }
    else if (activeFilter === 'PROGRAMMATIC') {
        const epochs = ['PAST', 'PRESENT', 'FUTURE'];
        const programs = filterConfigs[activeFilter].headers;
    
        programs.forEach((program, programIndex) => {
            const programSection = document.createElement('div');
            programSection.className = 'program-section';
            programSection.style.display = 'flex';
            programSection.style.flexDirection = 'column';
            programSection.style.alignItems = 'center';
    
            // Add margins for RESIDENTIAL, MASTERPLAN and their neighbors
            if (program === 'RESIDENTIAL' || program === 'MASTERPLAN') {
                programSection.style.margin = '0 -10px';
            } else if (programs[programIndex + 1] === 'RESIDENTIAL' || programs[programIndex + 1] === 'MASTERPLAN') {
                programSection.style.margin = '0 20px 0 -5px';
            } else if (programs[programIndex - 1] === 'RESIDENTIAL' || programs[programIndex - 1] === 'MASTERPLAN') {
                programSection.style.margin = '0 -8px 0 20px';
            } else {
                programSection.style.margin = '0 -8px';
            }
            
            const columnsContainer = document.createElement('div');
            columnsContainer.className = 'program-category-columns';
            columnsContainer.style.display = 'flex';
            columnsContainer.style.justifyContent = 'center';
            columnsContainer.style.width = '100%';
            columnsContainer.style.gap = '0';
            columnsContainer.style.marginBottom = '-0.6rem';
    
            const epochColumnWidth = getColumnWidth(filterConfigs[activeFilter].headers.length * 3) * 0.8;
    
            epochs.forEach((epoch, index) => {
                const epochColumn = document.createElement('div');
                epochColumn.className = 'epoch-column';
                epochColumn.style.width = `${epochColumnWidth - 10}px`;
    
                // Add margin based on position for both RESIDENTIAL and MASTERPLAN
                if (program === 'RESIDENTIAL' || program === 'MASTERPLAN') {
                    if (epoch === 'PRESENT') {
                        epochColumn.style.margin = '0 20px';
                    } else if (epoch === 'PAST') {
                        epochColumn.style.margin = '0 -5px 0 0';
                    } else if (epoch === 'FUTURE') {
                        epochColumn.style.margin = '0 0 0 27px';
                    }
                }
    
                // Special handling for RESIDENTIAL and MASTERPLAN programs in PRESENT epoch
                if ((program === 'RESIDENTIAL' || program === 'MASTERPLAN') && epoch === 'PRESENT') {
                    const twoColumnsContainer = document.createElement('div');
                    twoColumnsContainer.style.display = 'flex';
                    twoColumnsContainer.style.justifyContent = 'center';
                    twoColumnsContainer.style.gap = '43px';
                    twoColumnsContainer.style.width = '100%';
                    twoColumnsContainer.style.marginBottom = '0.6rem';
    
                    const columns = [];
                    for (let i = 0; i < 2; i++) {
                        const column = document.createElement('div');
                        column.style.width = `calc(50% - 16px)`;
                        column.style.display = 'flex';
                        column.style.flexDirection = 'column-reverse';
                        column.style.gap = '7px';
                        columns.push(column);
                        twoColumnsContainer.appendChild(column);
                    }
    
                    const filteredProjects = projects.filter(
                        project => project.program === program && project.epoch === epoch
                    );
    
                    // New distribution logic for uneven columns
                    const totalProjects = filteredProjects.length;
                    const firstColumnCount = Math.ceil(totalProjects * 0.6); // 60% to first column
                    const secondColumnCount = totalProjects - firstColumnCount;
    
                    // Distribute projects to columns
                    for (let i = 0; i < firstColumnCount; i++) {
                        const projectIcon = createProjectIcon(filteredProjects[i], activeFilter);
                        columns[0].appendChild(projectIcon);
                    }
    
                    for (let i = 0; i < secondColumnCount; i++) {
                        const projectIcon = createProjectIcon(filteredProjects[firstColumnCount + i], activeFilter);
                        columns[1].appendChild(projectIcon);
                    }
    
                    epochColumn.appendChild(twoColumnsContainer);
                } else {
                    const projectStack = document.createElement('div');
                    projectStack.className = 'project-stack';
                    projectStack.style.display = 'flex';
                    projectStack.style.flexDirection = 'column-reverse';
                    projectStack.style.gap = '7px';
    
                    const filteredProjects = projects.filter(
                        project => project.program === program && project.epoch === epoch
                    );
    
                    filteredProjects.forEach(project => {
                        const projectIcon = createProjectIcon(project, activeFilter);
                        projectStack.appendChild(projectIcon);
                    });
    
                    epochColumn.appendChild(projectStack);
                }
    
                columnsContainer.appendChild(epochColumn);
            });
    
            const programHeader = document.createElement('div');
            programHeader.className = 'header program-header';
            programHeader.textContent = program;
            programHeader.style.width = `${epochColumnWidth * 3 + 32}px`;
            programHeader.style.textAlign = 'center';
    
            programSection.appendChild(columnsContainer);
            programSection.appendChild(programHeader);
            
            grid.appendChild(programSection);
        });
    }
    else if (activeFilter === 'SCALE') {
        const programOrder = ['MASTERPLAN', 'HOSPITALITY', 'OTHERS', 'TRANSPORTATION', 'RESIDENTIAL', 'OFFICE'];
        const scales = filterConfigs[activeFilter].headers;
        const scaleWidth = getColumnWidth(scales.length) * 1.5;
    
        scales.forEach((scale, index) => {
            const scaleSection = document.createElement('div');
            scaleSection.className = 'scale-category-section';
            scaleSection.style.width = `${scaleWidth}px`;
            
            if (scale === 'M') {
                scaleSection.style.margin = '0 20px';
            } else if (scales[index + 1] === 'M') {
                scaleSection.style.margin = '0 18px 0 2px';
            } else if (scales[index - 1] === 'M') {
                scaleSection.style.margin = '0 2px 0 57px';
            } else {
                scaleSection.style.margin = '0 2px';
            }
    
            const columnsContainer = document.createElement('div');
            columnsContainer.className = 'scale-category-columns';
            columnsContainer.style.display = 'flex';
            columnsContainer.style.justifyContent = 'center';
            columnsContainer.style.marginBottom = '0rem';
    
            // Special styling for M scale
            if (scale === 'M') {
                columnsContainer.style.gap = '45px';  // Adjusted gap for 5 columns
                columnsContainer.style.width = `${scaleWidth}px`;
                columnsContainer.style.display = 'flex';
                columnsContainer.style.justifyContent = 'center';
                columnsContainer.style.paddingLeft = '0';
                columnsContainer.style.paddingRight = '0';
                columnsContainer.style.marginBottom = '-1.31rem';
            } else {
                columnsContainer.style.width = '100%';
                columnsContainer.style.gap = '7px';
            }
    
            // Determine number of columns - now 5 for M scale
            const numColumns = scale === 'M' ? 5 : 3;
    
            // Calculate column width based on scale
            const totalGapWidth = scale === 'M' ? (28 * (numColumns - 1)) : (7 * (numColumns - 1));
            const columnWidth = scale === 'M' 
                ? Math.floor((scaleWidth - totalGapWidth) / numColumns)
                : `${scaleWidth / numColumns - 7}px`;
    
            // Create columns
            const columns = [];
            for (let i = 0; i < numColumns; i++) {
                const column = document.createElement('div');
                column.className = 'scale-category-column';
                column.style.width = `${columnWidth}px`;
                column.style.display = 'flex';
                column.style.flexDirection = 'column-reverse';
                column.style.gap = '7px';
                column.style.flex = '0 0 auto';
    
                columnsContainer.appendChild(column);
                columns.push(column);
            }
    
            // Filter and group projects by program
            const scaleProjects = projects.filter(project => project.scale === scale);
            const projectsByProgram = {};
            programOrder.forEach(program => {
                projectsByProgram[program] = scaleProjects.filter(project => project.program === program);
            });
    
            // Calculate rows needed
            const totalProjects = scaleProjects.length;
            const numRows = Math.ceil(totalProjects / numColumns);
            const projectGrid = Array(numRows).fill(null).map(() => Array(numColumns).fill(null));
    
            // Fill grid by rows
            let currentProgram = 0;
            let currentProgramProjects = projectsByProgram[programOrder[currentProgram]] || [];
    
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numColumns; col++) {
                    while (currentProgramProjects.length === 0 && currentProgram < programOrder.length - 1) {
                        currentProgram++;
                        currentProgramProjects = projectsByProgram[programOrder[currentProgram]] || [];
                    }
    
                    if (currentProgramProjects.length > 0) {
                        projectGrid[row][col] = currentProgramProjects.shift();
                    }
                }
            }
    
            // Add projects to columns
            for (let row = 0; row < numRows; row++) {
                for (let col = 0; col < numColumns; col++) {
                    const project = projectGrid[row][col];
                    if (project) {
                        const projectIcon = createProjectIcon(project, activeFilter);
                        columns[col].appendChild(projectIcon);
                    }
                }
            }
    
            const headerDiv = document.createElement('div');
            headerDiv.className = 'header';
            headerDiv.textContent = scale;
            headerDiv.style.width = '100%';
            headerDiv.style.textAlign = 'center';
            
            if (scale === 'M') {
                headerDiv.style.marginTop = '20px';
            }
    
            scaleSection.appendChild(columnsContainer);
            scaleSection.appendChild(headerDiv);
            grid.appendChild(scaleSection);
        });
    }
    else {
        // Original layout for other filters
        filterConfigs[activeFilter].headers.forEach(header => {
            const column = document.createElement('div');
            column.className = 'column';
            column.style.width = `${getColumnWidth(filterConfigs[activeFilter].headers.length)}px`;

            const projectStack = document.createElement('div');
            projectStack.className = 'project-stack';

            const filteredProjects = projects.filter(
                project => filterConfigs[activeFilter].getHeader(project) === header
            );

            filteredProjects.forEach(project => {
                const projectIcon = createProjectIcon(project, activeFilter);
                projectStack.appendChild(projectIcon);
            });

            const headerDiv = document.createElement('div');
            headerDiv.className = 'header';
            headerDiv.textContent = header;

            column.appendChild(projectStack);
            column.appendChild(headerDiv);
            grid.appendChild(column);
        });
    }

    // Animation handling
    const newIcons = Array.from(grid.querySelectorAll('.project-icon'));
    newIcons.forEach(icon => {
        const layoutId = icon.dataset.layoutId;
        const rect = icon.getBoundingClientRect();
        const oldPos = oldPositions.get(layoutId);

        if (oldPos) {
            const deltaX = oldPos.left - rect.left;
            const deltaY = oldPos.top - rect.top;
            const scaleX = oldPos.width / rect.width;
            const scaleY = oldPos.height / rect.height;

            icon.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
            icon.style.opacity = '0';

            requestAnimationFrame(() => {
                icon.style.transform = 'translate(0, 0) scale(1, 1)';
                icon.style.opacity = '1';
                icon.classList.add('transitioning');
            });
        } else {
            icon.style.opacity = '0';
            icon.style.transform = 'scale(0.8)';
            icon.classList.add('transitioning');
            requestAnimationFrame(() => {
                icon.style.opacity = '1';
                icon.style.transform = 'scale(1)';
            });
        }
    });
}
document.addEventListener('DOMContentLoaded', () => {
    const content = document.querySelector('.content');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectGrid = document.getElementById('projectGrid');    
    let activeHoverArea = null;
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const resetTabs = () => {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => {
            content.classList.remove('active');
            content.scrollTop = 0; // Reset scroll position when resetting tabs
        });
        
        if (tabButtons.length > 0 && tabContents.length > 0) {
            tabButtons[0].classList.add('active');
            const firstTabId = tabButtons[0].dataset.tab;
            document.getElementById(firstTabId).classList.add('active');
        }
    };

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => {
                content.classList.remove('active');
                content.scrollTop = 0;
            });

            button.classList.add('active');
            const tabId = button.dataset.tab;
            const activeContent = document.getElementById(tabId);
            activeContent.classList.add('active');
            activeContent.scrollTop = 0;
        });
    });

    const infoTab = document.querySelector('.info-tab');
    const infoModal = document.getElementById('infoModal');
    const infoHomeButton = infoModal.querySelector('.home-modal');
    const infoCloseButton = infoModal.querySelector('.info-close');

    // Update the close button with the desired SVG
    infoCloseButton.innerHTML = `
        <svg width="40" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter">
            <line x1="20" y1="6" x2="6" y2="20"></line>
            <line x1="6" y1="6" x2="20" y2="20"></line>
        </svg>
    `;
    
    // Info Modal Open
    infoTab.addEventListener('click', () => {
        resetTabs();
        infoModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });

    infoHomeButton.onclick = () => {
        infoModal.style.display = 'none';
        window.scrollTo(0, 0);
        document.body.style.overflow = 'auto';
        resetTabs();
    };

    infoCloseButton.addEventListener('click', () => {
        infoModal.style.display = 'none';
        document.body.style.overflow = 'auto';
        resetTabs();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && infoModal.style.display === 'flex') {
            infoModal.style.display = 'none';
            document.body.style.overflow = 'auto';
            resetTabs();
        }
    });

    // Rest of the event listeners remain unchanged
    projectGrid.addEventListener('mousemove', (event) => {
        const hoverText = document.querySelector('.hover-text');
        const projectIcon = event.target.closest('.project-icon');
        
        if (hoverText && projectIcon) {
            const iconRect = projectIcon.getBoundingClientRect();
            
            const isWithinHoverArea = (
                event.clientX >= iconRect.left &&
                event.clientX <= iconRect.right &&
                event.clientY >= iconRect.top &&
                event.clientY <= iconRect.bottom
            );
            
            if (isWithinHoverArea) {
                hoverText.style.left = `${event.pageX + 15}px`;
                hoverText.style.top = `${event.pageY - 10}px`;
                hoverText.style.opacity = '1';
            } else {
                hoverText.style.opacity = '0';
            }
        }
    });

    // Existing Project Grid Mouse Over Handler remains unchanged
    projectGrid.addEventListener('mouseover', (event) => {
        const projectIcon = event.target.closest('.project-icon');
        
        if (projectIcon && !activeHoverArea) {
            activeHoverArea = projectIcon;
            const hoverText = document.createElement('div');
            hoverText.classList.add('hover-text');
            hoverText.innerText = projectIcon.getAttribute('title');
            document.body.appendChild(hoverText);

            projectIcon.dataset.originalTitle = projectIcon.getAttribute('title');
            projectIcon.removeAttribute('title');

            projectIcon.classList.add('hover-active');
        }
    });

    // Existing event listeners remain unchanged
    projectGrid.addEventListener('mouseout', (event) => {
        const projectIcon = event.target.closest('.project-icon');
        const relatedTarget = event.relatedTarget;
        
        if (projectIcon && 
            !projectIcon.contains(relatedTarget) && 
            !relatedTarget?.closest('.project-icon-hover')) {
            
            const hoverText = document.querySelector('.hover-text');
            if (hoverText) {
                hoverText.remove();
            }

            if (activeHoverArea) {
                if (activeHoverArea.dataset.originalTitle) {
                    activeHoverArea.setAttribute('title', activeHoverArea.dataset.originalTitle);
                    delete activeHoverArea.dataset.originalTitle;
                }
                activeHoverArea.classList.remove('hover-active');
                activeHoverArea = null;
            }
        }
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateGrid(button.dataset.filter);
        });
    });

    updateGrid('CHRONOLOGICAL');
});
window.addEventListener('resize', () => {
    const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
    updateGrid(activeFilter);
});

document.addEventListener("DOMContentLoaded", function () {
    const mainSearchInput = document.getElementById("mainSearchInput");
    const searchContent = document.getElementById("searchContent");
    const searchIcon = document.querySelector(".search-icon");
    const filterButtons = document.querySelectorAll('.filter-btn');
    let globeInstance = null;
    let searchDebounceTimer = null;
    let currentSearchResults = new Set();

    // Updated suggestions to include both tags and clients
    const suggestions = {
        tags: ["HIGH-RISE", "AWARDED", "INTERIOR", "BUILT", "BAY POINT"],
        clients: ["WOW INVEST. LIMITED", "AL REEM REAL ESTATE DEVELOPMENT EST", "WASL", "TECOM GROUP","DGCL","MODON","BOUTIQUE GROUP","PIF","MODON PROPERTIES","MBC",
            "EAST & WEST PROPERTIES","UNITED DEVELOPMENT CO.","ROSHN","NEOM","MAJID AL FUTTAIM PROPERTIES","NEW MURABBA","DIFC","ALDAR",
            "ENOC","BEYON","PRIVATE","EMAAR PROPERTIES","OMRAN GROUP","NAKHEEL","ROYAL COMMISSION FOR AL-ULA","ELLINGTON", "AL REEM REAL ESTATE DEVELOPMENT EST", 
            "SOUDAH DEVELOPMENT COMPANY", "FISHER MAN'S COVE HOTEL LIMITED", "RTA", "SELECT GROUP", "ITHMAAR DEVELOPMENT COMPANY", "AL MADDAHIA", "QIDDIYA", 
            "FAKIEH GROUP", "MINISTRY OF CULTURE", "RAHIM HOLDINGS W.L.L.", "ABDUL LATIF JAMEEL", "FAISAL ASGHAR ENTERPRISES (PVT) LIMITED", "AL NAHDA REAL ESTATE TR. CO. LLC"
        , "FISHERMAN'S COVE HOTEL LIMITED", "DUBAI PROPERTIES", "FOOTBALL", "GEMINI PROPERTY DEVELOPERS"]
    };

    searchIcon.addEventListener("click", function() {
        mainSearchInput.classList.toggle("visible");
        if (mainSearchInput.classList.contains("visible")) {
            mainSearchInput.focus();
        } else {
            searchContent.style.display = "none";
        }
    });

    mainSearchInput.addEventListener("input", function() {
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }

        searchDebounceTimer = setTimeout(() => {
            const query = mainSearchInput.value.toLowerCase().trim();
            updateSearchResults(query);
        }, 150);
    });

    // Cache DOM elements and project data
    const projectElements = new Map();
    const projectsCache = new Map(projects.map(project => [project.id, project]));

    document.querySelectorAll('.project-icon').forEach(icon => {
        const projectId = parseInt(icon.dataset.layoutId.split('-')[1]);
        projectElements.set(projectId, icon);
    });

    function updateSearchResults(query) {
        searchContent.innerHTML = "";
        searchContent.style.display = query ? "block" : "none";
        
        if (!query) {
            currentSearchResults.clear();
            showAllProjects();
            return;
        }

        const displayedResults = new Set();
        currentSearchResults.clear();

        // Add tag suggestions
        const matchingTags = suggestions.tags.filter(tag => 
            tag.toLowerCase().includes(query.toLowerCase()) && 
            !displayedResults.has(tag)
        );

        matchingTags.forEach(tag => {
            displayedResults.add(tag);
            const result = createSearchResult(null, tag, 'tag');
            searchContent.appendChild(result);
        });

        // Add client suggestions
        const matchingClients = suggestions.clients.filter(client => 
            client.toLowerCase().includes(query.toLowerCase()) && 
            !displayedResults.has(client)
        );

        matchingClients.forEach(client => {
            displayedResults.add(client);
            const result = createSearchResult(null, client, 'client');
            searchContent.appendChild(result);
        });

        // Project search logic
        const startsWithQuery = [];
        const containsQuery = [];
        const otherMatches = [];
        
        projects.forEach(project => {
            const projectTitle = project.title.toLowerCase();
            const queryLower = query.toLowerCase();
            const hasMatchingTag = project.tags && project.tags.some(tag => 
                tag.toLowerCase().includes(queryLower)
            );
            const hasMatchingClient = project.client && 
                project.client.toLowerCase().includes(queryLower);

            if (displayedResults.has(project.title)) {
                return;
            }

            if (projectTitle.startsWith(queryLower)) {
                startsWithQuery.push(project);
            } else if (projectTitle.includes(queryLower)) {
                containsQuery.push(project);
            } else if (
                project.typology?.toLowerCase().includes(queryLower) ||
                project.program?.toLowerCase().includes(queryLower) ||
                project.location?.toLowerCase().includes(queryLower) ||
                hasMatchingTag ||
                hasMatchingClient
            ) {
                otherMatches.push(project);
            }
        });

        [...startsWithQuery, ...containsQuery, ...otherMatches].forEach(project => {
            currentSearchResults.add(project);
            if (!displayedResults.has(project.title)) {
                displayedResults.add(project.title);
                const result = createSearchResult(project);
                searchContent.appendChild(result);
            }
        });

        updateVisibilityBasedOnCurrentFilter();
    }

    function createSearchResult(project, keyword = null, type = null) {
        const result = document.createElement("div");
        result.classList.add("search-result");

        if (keyword) {
            // Add label for client suggestions
            if (type === 'client') {
                const clientLabel = document.createElement('span');
                clientLabel.className = 'client-label';
                clientLabel.textContent = 'CLIENT: ';
                result.appendChild(clientLabel);
                
                const clientText = document.createElement('span');
                clientText.textContent = keyword;
                result.appendChild(clientText);
            } else {
                result.textContent = keyword;
            }

            result.addEventListener("click", () => {
                mainSearchInput.value = keyword;
                if (type === 'client') {
                    filterProjectsByClient(keyword);
                } else {
                    filterProjectsByKeyword(keyword);
                }
            });
        } else if (project) {
            result.textContent = project.title;
            result.addEventListener("click", () => {
                const fullProject = projectsCache.get(project.id) || project;
                openProjectModal(fullProject, mainSearchInput.value);
            });
        }

        return result;
    }

    function filterProjectsByClient(clientName) {
        const matchingProjects = new Set();
        
        projects.forEach(project => {
            if (project.client === clientName) {
                matchingProjects.add(project);
            }
        });

        currentSearchResults = matchingProjects;
        updateVisibilityBasedOnCurrentFilter();
        searchContent.style.display = "none";
    }

    function filterProjectsByKeyword(keyword) {
        const matchingProjects = new Set();
        const requiredTags = suggestions.tags;
        
        projects.forEach(project => {
            if (project.tags && requiredTags.includes(keyword)) {
                if (project.tags.includes(keyword)) {
                    matchingProjects.add(project);
                }
            }
            
            if (project.typology === keyword || project.program === keyword) {
                matchingProjects.add(project);
            }
        });

        currentSearchResults = matchingProjects;
        updateVisibilityBasedOnCurrentFilter();
        searchContent.style.display = "none";
    }

    function updateVisibilityBasedOnCurrentFilter() {
        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        if (activeFilter === 'LOCATION' && globeInstance) {
            updateGlobeMarkersVisibility(currentSearchResults);
        } else {
            updateProjectVisibility(currentSearchResults);
        }
    }

    function updateProjectVisibility(matchingProjects) {
        const projectIcons = document.querySelectorAll('.project-icon');
        
        projectIcons.forEach(icon => {
            const projectId = parseInt(icon.dataset.layoutId.split('-')[1]);
            const project = projects.find(p => p.id === projectId);
            
            if (matchingProjects.size === 0 || matchingProjects.has(project)) {
                icon.style.display = "block";
                icon.style.visibility = "visible";
                icon.style.position = "relative";
            } else {
                icon.style.display = "none";
                icon.style.visibility = "hidden";
                icon.style.position = "absolute";
            }
        });
    }

    function showAllProjects() {
        const projectIcons = document.querySelectorAll('.project-icon');
        projectIcons.forEach(icon => {
            icon.style.display = "block";
            icon.style.visibility = "visible";
            icon.style.position = "relative";
        });
        
        if (document.querySelector('.filter-btn.active').dataset.filter === 'LOCATION' && globeInstance) {
            globeInstance.resetAllMarkers();
        }
    }

    // Close search results when clicking outside
    document.addEventListener("click", function(event) {
        if (!event.target.closest(".search-tab") && !event.target.closest("#searchContent")) {
            mainSearchInput.classList.remove("visible");
            searchContent.style.display = "none";
        }
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateGrid(button.dataset.filter);
            
            if (currentSearchResults.size > 0) {
                updateVisibilityBasedOnCurrentFilter();
            }
        });
    });

    function updateGrid(filterType) {
        if (currentSearchResults.size > 0) {
            updateVisibilityBasedOnCurrentFilter();
        }
    }

    // Initialize with default view
    updateGrid('CHRONOLOGICAL');
});


document.addEventListener('DOMContentLoaded', () => {
    const iconLegendTab = document.querySelector('.icon-legend-tab');
    const iconLegendModal = document.getElementById('iconLegendModal');
    const legendCloseButton = iconLegendModal.querySelector('.legend-close');
    const legendSections = document.querySelectorAll('.legend-section');

    // Update the close button with the same SVG as info modal
    legendCloseButton.innerHTML = `
        <svg width="40" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="butt" stroke-linejoin="miter">
            <line x1="20" y1="6" x2="6" y2="20"></line>
            <line x1="6" y1="6" x2="20" y2="20"></line>
        </svg>
    `;

    // Icon Legend Modal Open with morphing animation
    iconLegendTab.addEventListener('click', () => {
        // First make the modal visible but not yet animated
        iconLegendModal.style.display = 'flex';
        
        // Force a reflow to ensure the initial state is rendered
        iconLegendModal.offsetHeight;
        
        // Add active class to trigger the morphing animation
        iconLegendModal.classList.add('active');
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Animate the sections after the modal animation
        setTimeout(() => {
            legendSections.forEach(section => {
                section.classList.add('active');
            });
        }, 300); // Delay matches the modal transition duration
    });

    function closeModal() {
        // Remove active class to trigger closing animation
        iconLegendModal.classList.remove('active');
        
        // Remove section animations
        legendSections.forEach(section => {
            section.classList.remove('active');
        });
        
        // Wait for animation to complete before hiding
        setTimeout(() => {
            iconLegendModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300); // Match the transition duration
        
        // Scroll to top
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }



    // Close button click handler
    legendCloseButton.addEventListener('click', closeModal);

    // ESC key handler
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && iconLegendModal.style.display === 'flex') {
            closeModal();
        }
    });
});
document.querySelectorAll('.image-link').forEach(link => {
    const defaultImage = link.querySelector('.default-image');
    const hoverImage = link.querySelector('.hover-image');

    link.addEventListener('mouseover', function() {
        this.style.zIndex = '3';
        defaultImage.style.opacity = '0';
        hoverImage.style.opacity = '1';
    });

    link.addEventListener('mouseout', function() {
        this.style.zIndex = '2';
        defaultImage.style.opacity = '1';
        hoverImage.style.opacity = '0';
    });
});