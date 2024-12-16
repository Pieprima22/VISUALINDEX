function createGlobe() {
    const scene = new THREE.Scene();
    
    const width = window.innerWidth * 0.9;
    const height = window.innerHeight * 0.7;
    
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

    camera.position.z = 10;

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
    const MIN_ZOOM = 9;
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
            'KSA, SAUDI ARABIA': { lat: 23.8859, lng: 45.0792 }
        };

        Object.entries(projectsByLocation).forEach(([location, locationProjects]) => {
            const coords = locationCoords[location];
            if (!coords) return;

            const basePosition = latLngToVector3(coords.lat, coords.lng, GLOBE_RADIUS);

            locationProjects.forEach((project, index) => {
                const markerSize = 0.5;
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
                
                const verticalOffset = index * (markerSize * 0.2);
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
        currentMarker.scale.setScalar(1.2);
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
        image: "./ICON/SLS.png", // Updated path
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b6964d2f-924b-44d0-903d-f6a28fdab2fa&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=368e0a72-3654-47d7-bbfc-028aa41a7f32&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
        // New fields for the description section
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ff6a656d-b0de-48cc-b510-2d6124a61fe1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true', 
        description: {
            paragraph1: "The SLS WOW Hotel Apartment project in Dubai represents a pinnacle of luxury hospitality design. Completed in 2015, this ambitious development seamlessly integrates contemporary architectural elements with the sophistication expected of the SLS brand. The project's location in Dubai, UAE, serves as a strategic point for both business and leisure travelers.",
            paragraph2: "The architectural design emphasizes vertical elegance while maintaining a strong connection to its urban context. Each apartment is meticulously crafted to meet the high standards of modern luxury living, featuring premium finishes and state-of-the-art amenities. The building's facade incorporates innovative design elements that respond to the local climate while creating a distinctive visual identity.",
            paragraph3: "Sustainability and user comfort were key considerations throughout the design process. The project incorporates advanced environmental systems and smart building technologies, setting new standards for hospitality developments in the region. The result is a harmonious blend of luxury, functionality, and sustainable design that caters to the demanding requirements of modern urban living."
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
        image: "./ICON/RAD.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=6a92700b-869b-421d-b104-9f30d88488f6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=e3e8dddb-eb6e-409d-938d-a8eb1e3eafd6&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2016, 
        client: 'AL REEM REAL ESTATE DEVELOPMENT EST',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY', 
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
        hoverImage: "./hover/RAD.png",
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
        image: "./ICON/WMS.png",
        hoverImage: "./hover/WMS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7894ce44-5ab4-4be9-8db5-6c9f34131b02&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=128a0e23-8486-41fc-b8d7-91e679c13660&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2017, 
        client: 'WASL',
        program: 'HOSPITALITY',
        typology: 'HOSPITALITY',  
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
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
        image: "./ICON/CGA.png",
        hoverImage: "./hover/CGA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=9ddccb4a-8bf0-49d8-ac18-0434bc5212d8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=1b2b58cc-e601-4417-a184-9ca8769a590e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a2b3206f-37d8-4589-939b-898362ec0dd7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            "https://aedasme.egnyte.com/opendocument.do?entryId=64631a51-3a3a-41d0-aae1-46b092d7053c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 5, 
        title: 'SILVER BEACH', 
        abbr: 'SVB', 
        image: "./ICON/SVB.png",
        hoverImage: "./hover/SVB.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=76310ef9-9995-4d0f-a1da-3ba406972810&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=e40fd062-1c02-4602-af89-588a1386b413&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            "https://aedasme.egnyte.com/opendocument.do?entryId=cee8b079-6d0f-48d7-94ef-731a9aa5d56f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=a17b177d-07ff-4611-8bc1-c6f221878297&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=173a0110-d12c-430f-bb37-a2d81677de75&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=3a231a0c-2f30-46e9-99d7-2cff92b9ad03&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true"
        ]
    },
    { 
        id: 6, 
        title: 'RUA AL HARAM 2020', 
        abbr: 'RUH', 
        image: "./ICON/RUA.png",
        hoverImage: "./hover/RUA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=1866152a-6a90-42ff-8862-73df144a1d70&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=e727b7fb-8b8f-40de-b2a3-b57adffcd25b&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
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
        image: "./ICON/SKI.png",
        hoverImage: "./hover/SKI.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=98b3a94f-1eca-418e-8c4a-410881bbbbdf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=bc030824-0fbc-4242-80f1-b91854ec6d1e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2021, 
        client: 'NEOM',
        program: 'MASTERPLAN',
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'L', 
        epoch: 'FUTURE', 
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
        image: "./ICON/MNZ.png",
        hoverImage: "./hover/MNZ.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2fceb334-d42f-4ea4-ac52-515d18e8341d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=b9a04c15-f1bc-401b-a0a7-81f7f052061a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
        image: "./ICON/ELP.png",
        hoverImage: "./hover/ELP.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=40886ea5-bda5-4448-8cd9-a8eeb4c50bab&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=87623eed-e4aa-4f0b-bb9c-1e93d4336f64&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
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
        image: "./ICON/MOR.png",
        hoverImage: "./hover/MOR.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c9bdad2f-b266-4834-af53-5bd383057e19&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=ac894b5a-4921-476e-bc40-7dc26352b6b1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
        image: "./ICON/JA2.png",
        hoverImage: "./hover/JA2.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=2f1ab495-83b0-4871-ab42-ed854f2d9f47&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=dbd1df79-9a79-49c4-8b98-c14d1875d23e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
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
        image: "./ICON/VDA.png",
        hoverImage: "./hover/VDA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ccab3421-de6d-415c-bc66-f7d9af580fe2&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=0f85d708-3cf3-44ac-b454-33a69671f209&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2016, 
        client: 'EMAAR PROPERTIES',
        program: 'HOSPITALITY', 
        typology: 'HOSPITALITY', 
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
        image: "./ICON/GOLF.png",
        hoverImage: "./hover/GOLF.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=a3cc079e-6020-4e2a-83df-90f53b35ac20&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=d0de8d11-ad14-4b3d-bb1b-250876bc9f43&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2017, 
        client: 'EMAAR PROPERTIES',
        program: 'RESIDENTIAL',
        typology: 'RESIDENTIAL',  
        location: 'DUBAI, UAE',
        scale: 'S', 
        epoch: 'PRESENT', 
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
        image: "./ICON/GOLF.png",
        hoverImage: "./hover/GOLF.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=1e5e63f2-5fd9-4f83-ab07-22f7a1ecb35f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=3e24b9a5-7811-4c9c-9596-fbd50572e1fe&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2017, 
        client: 'EMAAR PROPERTIES',
        program: 'RESIDENTIAL', 
        typology: 'RESIDENTIAL', 
        location: 'DUBAI, UAE',
        scale: 'S', 
        epoch: 'PRESENT', 
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
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=f5ad907e-566b-43be-b387-c419969b65c9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2018, 
        client: 'ENOC',
        program: 'TRANSPORTATION',
        typology: 'TRANSPORTATION',  
        location: 'DUBAI, UAE',
        scale: 'S', 
        epoch: 'FUTURE', 
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
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
        image: "./ICON/MED.png",
        hoverImage: "./hover/MED.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7a02a260-ff44-4e7f-b103-cce302af104e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=db079bd4-79be-49e6-8347-3602a51644df&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
        image: "./ICON/NBY.png",
        hoverImage: "./hover/NBY.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=8215a838-d512-42b1-8969-d6b419e10c44&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=64ccfec3-766e-493b-b46a-3a541f224956&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
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
        image: "./ICON/D3O.png",
        hoverImage: "./hover/D3O.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=9ed03bc4-0f39-4ce8-9fcc-389645a1aba1&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=009ade26-1a71-4082-847b-2b941d17e9cf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2019, 
        client: 'TEACOM',
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
        image: "./ICON/HAB.png",
        hoverImage: "./hover/HAB.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=67123175-567e-40d2-9b31-12b3ac7dcd61&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=74d56dd6-04ee-4a6d-a3aa-00b02a551cc3&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2020, 
        client: 'ROYAL COMMISSION FOR AL-ULA',
        program: 'MASTERPLAN', 
        typology: 'MASTERPLAN',  
        location: 'KSA, SAUDI ARABIA',
        scale: 'M', 
        epoch: 'PRESENT', 
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
        descriptionImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=852c1ef0-8b14-4346-bf0d-db4dc9b15fdb&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        description: {
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
        },
        teamMembers: "AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF, AFSDFADSFAFD, BOB SMITH, ADRIAN SMITH, BOB SMITH, SKI VILLAGE, AFDAFDSFA, AFSDFADFSAF, AFDAFDSFA, AFSDFADFSAF",

        galleryImages: [
            "https://aedasme.egnyte.com/opendocument.do?entryId=84c1975f-78f8-4c5e-b85c-4da3cfc35a94&forceDownload=false&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
            "https://aedasme.egnyte.com/opendocument.do?entryId=cfd17305-1860-482c-b454-99db7c559ece&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true",
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
        image: "./ICON/ADQ.png",
        hoverImage: "./hover/ADQ.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=ffaa830e-1669-4716-8a4a-71a299fb48c9&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=2dbed23c-c70c-47f9-84e6-b25cf9405ba5&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
        title: 'WADI SAFAR', 
        abbr: 'WDS', 
        image: "/ICON/WDS.png",
        hoverImage: "./hover/WDS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=12db4279-9e1f-4af7-b190-c41a24be3c6f&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=a17543a6-eed0-49c1-aeed-37cfc9122db0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
        image: "/ICON/KSS.png",
        hoverImage: "./hover/KSS.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=4f92b890-318c-4b4d-a078-685605ca5281&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=c078e9dc-b68b-44e3-af9a-45ebfef75cc7&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
        image: "/ICON/PNT.png",
        hoverImage: "./hover/PNT.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=7f25fdb4-7944-4f92-9bc9-58b3d7208abf&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=0073207f-1f3b-4e24-9cbe-7d19d4cf2e05&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
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
        image: "/ICON/D3R.png",
        hoverImage: "./hover/D3R.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=fbb6ea8d-5c30-4159-8c7f-5201d680af2a&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=6711dc9f-ecda-41d0-8895-8cafb48f881d&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2022, 
        client: 'TEACOM',
        program: 'RESIDENTIAL', 
        typology: 'RESIDENTIAL',  
        location: 'DUBAI, UAE',
        scale: 'M', 
        epoch: 'PRESENT', 
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
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
        image: "/ICON/LGH.png",
        hoverImage: "./hover/LGH.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=f212ccf5-5eb5-43dc-a847-56ec73afd6c8&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=f197b87c-504f-40a5-bbe7-5797baae2374&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
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
        image: "/ICON/FCO.png",
        hoverImage: "./hover/FCO.jpg",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b0e85e3f-768c-4bfa-a77f-ccf5400bef0c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=d9438269-928b-44f7-8d97-4b1ef8540c3e&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
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
        image: "/ICON/CEC.png",
        hoverImage: "./hover/CEC.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=b0e85e3f-768c-4bfa-a77f-ccf5400bef0c&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=11f0beba-4a1d-4acd-9b34-881b596d8890&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
        image: "/ICON/STA.png",
        hoverImage: "./hover/STA.png",
        coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=543961a4-bab9-4a8c-9833-0fbfb6100dc0&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',    
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=b024391c-4156-4ac3-bd38-d841869b0e60&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
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
            paragraph1: "Nabr is a new type of consumer-first housing company. Founded by Roni Bahar, Bjarke Ingels, and Nick Chim - combining their experience in real estate, architecture, and technology, respectively - Nabr is the result of a shared vision for an improved way of urban living, defined by quality, sustainability, and attainability.",
            paragraph2: "Nabr uses technology and productization to increase the production of apartments available for sale in major cities, starting with SOFA One in San Jose which is co-designed by BIG and slated to break ground in late 2022.",
            paragraph3: "Located at 98 E San Salvador, residents will be at the heart of SOFA, downtown San Jose's arts district, in close proximity to dining and local entertainment. The development is roughly a mile from Diridon Caltrain Station, one block from San Jose State University, and centrally located near all major tech employers, offering residents abundant access to commuting options."
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
        abbr: 'HdV', 
        image: "./ICON/HDV.png",
       coverImage: 'https://aedasme.egnyte.com/opendocument.do?entryId=c38534dc-2fcb-4e9b-8d6d-c9cd82ec3d17&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        imageUrl: 'https://aedasme.egnyte.com/opendocument.do?entryId=963352ee-3ef0-4420-80ac-61f34b6cdcde&forceDownload=false&thumbNail=true&w=1200&h=1200&type=proportional&preview=true&prefetch=true',
        year: 2023, 
        client: 'MODON',
        program: 'RESIDENTIAL', 
        typology: ' RESIDENTIAL',
        location: 'ABU DHABI, UAE',
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
];

const filterConfigs = {
    CHRONOLOGICAL: {
        headers: Array.from({ length: 10 }, (_, i) => (2015 + i).toString()),
        getHeader: project => project.year.toString()
    },
    EPOCH: {
        headers: ['PAST', 'PRESENT', 'FUTURE'],
        getHeader: project => project.epoch
    },
    ALPHABETICAL: {
        headers: Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
        getHeader: project => project.abbr[0]
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
}

function createProjectIcon(project, filter) {
    const projectIcon = document.createElement('div');
    projectIcon.className = 'project-icon';
    projectIcon.title = project.title;
    projectIcon.dataset.layoutId = `project-${project.id}`;
    
    // Create and set up the main image
    const img = document.createElement('img');
    img.src = project.imageUrl;
    img.alt = project.title;
    img.className = 'project-icon-image';
    img.loading = 'lazy';
    
    // Create the hover cover image
    const hoverImg = document.createElement('img');
    hoverImg.src = project.coverImage || project.imageUrl;
    hoverImg.alt = project.title;
    hoverImg.className = 'project-icon-hover';
    hoverImg.loading = 'lazy';
    
    // Error handling
    img.onerror = () => {
        img.src = '/placeholder.png';
        console.warn(`Failed to load image for project: ${project.title}`);
    };
    
    hoverImg.onerror = () => {
        hoverImg.src = project.imageUrl;
    };
    
    projectIcon.appendChild(img);
    projectIcon.appendChild(hoverImg);
    return projectIcon;
}
function openProjectModal(project) {
    const modal = document.getElementById('projectModal');
    
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

    // Set the cover image
    document.getElementById('projectCoverImage').src = project.coverImage;
    document.getElementById('projectIconImage').src = project.imageUrl;

    // Set project details
    document.getElementById('projectTitle').textContent = project.title;
    document.getElementById('projectLocation').textContent = project.location || 'N/A';
    document.getElementById('projectDate').textContent = project.year || 'N/A';
    document.getElementById('projectClientValue').textContent = project.client || 'N/A';
    document.getElementById('projectTypologyValue').textContent = project.typology || 'N/A';

    // Set description section
    document.getElementById('projectDescriptionImage').src = project.descriptionImage || '';
    document.getElementById('descriptionParagraph1').textContent = project.description?.paragraph1 || 
        "The project's first conceptual framework emphasizes innovative design solutions that respond to both environmental and social contexts.";
    document.getElementById('descriptionParagraph2').textContent = project.description?.paragraph2 || 
        "Our approach integrates sustainable practices with modern functionality, resulting in spaces that are both environmentally conscious and aesthetically striking.";
    document.getElementById('descriptionParagraph3').textContent = project.description?.paragraph3 || 
        "The final outcome represents a harmonious blend of form and function, where each design element serves a purpose while contributing to the overall architectural narrative.";

    // Set team members section
    document.getElementById('teamLabel').textContent = "TEAM:";
    document.getElementById('teamMembers').textContent = project.teamMembers || 
        "Team members information not available";

    // Update project links
    const linksContainer = document.querySelector('.project-links');
    linksContainer.innerHTML = ''; // Clear existing links

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
    const galleryContainer = document.querySelector('.gallery-container');
    galleryContainer.innerHTML = ''; // Clear existing images

    // Check if project.galleryImages exists and is an array
    if (project.galleryImages && Array.isArray(project.galleryImages)) {
        project.galleryImages.forEach(imageUrl => {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'gallery-image-container';

            const image = document.createElement('img');
            image.src = imageUrl;
            image.className = 'gallery-image';
            image.alt = 'Project Gallery Image';

            // Add loading state
            image.onload = () => {
                imageContainer.classList.add('loaded');
            };
            image.onerror = () => {
                imageContainer.classList.add('error');
            };

            imageContainer.appendChild(image);
            galleryContainer.appendChild(imageContainer);
        });
    }

    // Remove any existing event listeners
    const closeButton = modal.querySelector('.close-modal');
    const homeButton = modal.querySelector('.home-modal');
    const oldKeydownHandler = modal.keydownHandler;
    if (oldKeydownHandler) {
        document.removeEventListener('keydown', oldKeydownHandler);
    }

    const closeModalAndReset = () => {
        modal.style.display = 'none';
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
}

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


    if (activeFilter === 'PROGRAMMATIC') {
        const epochs = ['PAST', 'PRESENT', 'FUTURE'];
        const programs = filterConfigs[activeFilter].headers;
    
        programs.forEach(program => {
            const programSection = document.createElement('div');
            programSection.className = 'program-section';
        
            const epochColumnsContainer = document.createElement('div');
            epochColumnsContainer.className = 'epoch-columns';
        
            // Calculate width for each epoch column
            const epochColumnWidth = getColumnWidth(filterConfigs[activeFilter].headers.length * 3) * 0.8;
        
            epochs.forEach(epoch => {
                const epochColumn = document.createElement('div');
                epochColumn.className = 'epoch-column';
                epochColumn.style.width = `${epochColumnWidth}px`;  // This needs to stay in JS since it's calculated
        
                const projectStack = document.createElement('div');
                projectStack.className = 'project-stack';
        
                const filteredProjects = projects.filter(
                    project => project.program === program && project.epoch === epoch
                );
        
                filteredProjects.forEach(project => {
                    const projectIcon = createProjectIcon(project, activeFilter);
                    projectStack.appendChild(projectIcon);
                });
        
                epochColumn.appendChild(projectStack);
                epochColumnsContainer.appendChild(epochColumn);
            });
        
            const programHeader = document.createElement('div');
            programHeader.className = 'header program-header';
            programHeader.textContent = program;
            programHeader.style.width = `${epochColumnWidth * 3 + 32}px`;  // This needs to stay in JS since it's calculated
        
            programSection.appendChild(epochColumnsContainer);
            programSection.appendChild(programHeader);
            grid.appendChild(programSection);
        });
    

    } else {
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
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectGrid = document.getElementById('projectGrid');    
    let activeHoverArea = null;
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const resetTabs = () => {
        // Remove active class from all buttons and contents
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Set the first tab as active (assuming you want the first tab as default)
        if (tabButtons.length > 0 && tabContents.length > 0) {
            tabButtons[0].classList.add('active');
            const firstTabId = tabButtons[0].dataset.tab;
            document.getElementById(firstTabId).classList.add('active');
        }
    };
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(tabId).classList.add('active');
        });
    });

    const infoTab = document.querySelector('.info-tab');
    const infoModal = document.getElementById('infoModal');
    const infoHomeButton = infoModal.querySelector('.home-modal');
    const infoCloseButton = infoModal.querySelector('.info-close');

        // Info Modal Open
        infoTab.addEventListener('click', () => {
            resetTabs(); // Reset tabs when opening the modal
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

        projectGrid.addEventListener('mousemove', (event) => {
            const hoverText = document.querySelector('.hover-text');
            const projectIcon = event.target.closest('.project-icon');
            
            if (hoverText && projectIcon) {
                // Changed to use projectIcon bounds instead of hover image
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
    // Existing Project Grid Mouse Over Handler
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

    // Existing Project Grid Mouse Out Handler
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

    // Existing Filter Buttons Handler
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

    // List of predefined keywords for auto-fill
    const suggestions = ["HIGH-RISE", "AWARDED", "CULTURAL", "RESIDENTIAL", "HOSPITALITY", "INTERIOR", "BUILT"];

    // Toggle search input visibility when clicking the search icon
    searchIcon.addEventListener("click", function() {
        mainSearchInput.classList.toggle("visible");
        if (mainSearchInput.classList.contains("visible")) {
            mainSearchInput.focus();
        } else {
            searchContent.style.display = "none";
        }
    });

    mainSearchInput.addEventListener("input", function() {
        const query = mainSearchInput.value.toLowerCase();
        updateSearchResults(query);
    });

    function updateSearchResults(query) {
        searchContent.innerHTML = "";
        searchContent.style.display = query ? "block" : "none";

        if (!query) {
            showAllProjects();
            return;
        }

        const displayedResults = new Set();
        const matchingProjects = new Set();

        // Search through projects
        projects.forEach(project => {
            if (project.title.toLowerCase().includes(query) ||
                project.typology?.toLowerCase().includes(query) ||
                project.program?.toLowerCase().includes(query) ||
                project.location?.toLowerCase().includes(query)) {

                matchingProjects.add(project);

                if (!displayedResults.has(project.title)) {
                    displayedResults.add(project.title);
                    const result = createSearchResult(project);
                    searchContent.appendChild(result);
                }
            }
        });

        // Add keyword suggestions
        suggestions.forEach(keyword => {
            if (keyword.toLowerCase().includes(query) && !displayedResults.has(keyword)) {
                displayedResults.add(keyword);
                const result = createSearchResult(null, keyword);
                searchContent.appendChild(result);
            }
        });

        // Update project visibility
        updateProjectVisibility(matchingProjects);
    }

    function createSearchResult(project, keyword = null) {
        const result = document.createElement("div");
        result.classList.add("search-result");

        if (keyword) {
            result.textContent = keyword;
            result.addEventListener("click", () => {
                mainSearchInput.value = keyword;
                filterProjectsByKeyword(keyword);
            });
        } else {
            result.textContent = project.title;
            result.addEventListener("click", () => {
                openProjectModal(project);
                mainSearchInput.value = "";
                searchContent.style.display = "none";
            });
        }

        return result;
    }

    function showAllProjects() {
        document.querySelectorAll('.project-icon').forEach(icon => {
            icon.style.display = "";
            icon.style.visibility = "visible";
            icon.style.position = "relative";
        });
    }

    function updateProjectVisibility(matchingProjects) {
        document.querySelectorAll('.project-icon').forEach(icon => {
            const projectId = icon.dataset.layoutId.split('-')[1];
            const project = projects.find(p => p.id === parseInt(projectId));
            
            if (matchingProjects.has(project)) {
                icon.style.display = "";
                icon.style.visibility = "visible";
                icon.style.position = "relative";
            } else {
                icon.style.display = "none";
                icon.style.visibility = "hidden";
                icon.style.position = "absolute";
            }
        });
    }

    function filterProjectsByKeyword(keyword) {
        const matchingProjects = new Set();
        
        projects.forEach(project => {
            if (project.typology === keyword || 
                project.program === keyword || 
                (keyword === "HIGH-RISE" && project.scale === "XL") ||
                (keyword === "INTERIOR" && project.typology === "INTERIOR") ||
                (keyword === "BUILT" && project.epoch === "PRESENT")) {
                matchingProjects.add(project);
            }
        });

        updateProjectVisibility(matchingProjects);
        searchContent.style.display = "none";
    }

document.addEventListener("DOMContentLoaded", function () {
    const mainSearchInput = document.getElementById("mainSearchInput");
    const searchContent = document.getElementById("searchContent");
    const searchIcon = document.querySelector(".search-icon");
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectGrid = document.getElementById('projectGrid');
    let globeInstance = null;
    let activeHoverArea = null;

    // List of predefined keywords for auto-fill
    const suggestions = ["HIGH-RISE", "AWARDED", "CULTURAL", "RESIDENTIAL", "HOSPITALITY", "INTERIOR", "BUILT"];

    // Toggle search input visibility when clicking the search icon
    searchIcon.addEventListener("click", function() {
        mainSearchInput.classList.toggle("visible");
        if (mainSearchInput.classList.contains("visible")) {
            mainSearchInput.focus();
        } else {
            searchContent.style.display = "none";
        }
    });

    mainSearchInput.addEventListener("input", function() {
        const query = mainSearchInput.value.toLowerCase();
        updateSearchResults(query);
    });

    function updateSearchResults(query) {
        searchContent.innerHTML = "";
        searchContent.style.display = query ? "block" : "none";

        if (!query) {
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
            if (activeFilter === 'LOCATION' && globeInstance) {
                // Reset all markers on globe
                globeInstance.getMarkerObjects().forEach(marker => {
                    marker.visible = true;
                    marker.scale.setScalar(1);
                    marker.material.opacity = 1;
                });
            } else {
                showAllProjects();
            }
            return;
        }

        const displayedResults = new Set();
        const matchingProjects = new Set();

        // Search through projects
        projects.forEach(project => {
            if (project.title.toLowerCase().includes(query) ||
                project.typology?.toLowerCase().includes(query) ||
                project.program?.toLowerCase().includes(query) ||
                project.location?.toLowerCase().includes(query)) {

                matchingProjects.add(project);

                if (!displayedResults.has(project.title)) {
                    displayedResults.add(project.title);
                    const result = createSearchResult(project);
                    searchContent.appendChild(result);
                }
            }
        });

        // Add keyword suggestions
        suggestions.forEach(keyword => {
            if (keyword.toLowerCase().includes(query) && !displayedResults.has(keyword)) {
                displayedResults.add(keyword);
                const result = createSearchResult(null, keyword);
                searchContent.appendChild(result);
            }
        });

        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        if (activeFilter === 'LOCATION' && globeInstance) {
            updateGlobeMarkersVisibility(matchingProjects);
        } else {
            updateProjectVisibility(matchingProjects);
        }
    }

    function createSearchResult(project, keyword = null) {
        const result = document.createElement("div");
        result.classList.add("search-result");

        if (keyword) {
            result.textContent = keyword;
            result.addEventListener("click", () => {
                mainSearchInput.value = keyword;
                filterProjectsByKeyword(keyword);
            });
        } else {
            result.textContent = project.title;
            result.addEventListener("click", () => {
                openProjectModal(project);
                mainSearchInput.value = "";
                searchContent.style.display = "none";
            });
        }

        return result;
    }

    function showAllProjects() {
        document.querySelectorAll('.project-icon').forEach(icon => {
            icon.style.display = "";
            icon.style.visibility = "visible";
            icon.style.position = "relative";
        });
    }

    function updateProjectVisibility(matchingProjects) {
        document.querySelectorAll('.project-icon').forEach(icon => {
            const projectId = icon.dataset.layoutId.split('-')[1];
            const project = projects.find(p => p.id === parseInt(projectId));
            
            if (matchingProjects.has(project)) {
                icon.style.display = "";
                icon.style.visibility = "visible";
                icon.style.position = "relative";
            } else {
                icon.style.display = "none";
                icon.style.visibility = "hidden";
                icon.style.position = "absolute";
            }
        });
    }

    function updateGlobeMarkersVisibility(matchingProjects) {
        if (!globeInstance) return;
        
        const markers = globeInstance.getMarkerObjects();
        markers.forEach(marker => {
            const project = marker.userData.project;
            if (matchingProjects.has(project)) {
                marker.visible = true;
                marker.scale.setScalar(1.2);
                marker.material.opacity = 1;
            } else {
                marker.visible = false;
                marker.scale.setScalar(1);
                marker.material.opacity = 0.5;
            }
        });
    }

    function filterProjectsByKeyword(keyword) {
        const matchingProjects = new Set();
        
        projects.forEach(project => {
            if (project.typology === keyword || 
                project.program === keyword || 
                (keyword === "HIGH-RISE" && project.scale === "XL") ||
                (keyword === "INTERIOR" && project.typology === "INTERIOR") ||
                (keyword === "BUILT" && project.epoch === "PRESENT")) {
                matchingProjects.add(project);
            }
        });

        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        if (activeFilter === 'LOCATION' && globeInstance) {
            updateGlobeMarkersVisibility(matchingProjects);
        } else {
            updateProjectVisibility(matchingProjects);
        }
        
        searchContent.style.display = "none";
    }

    function updateGrid(activeFilter) {
        const grid = document.getElementById('projectGrid');
        const oldIcons = Array.from(grid.querySelectorAll('.project-icon'));
        const oldPositions = new Map();

        oldIcons.forEach(icon => {
            const rect = icon.getBoundingClientRect();
            oldPositions.set(icon.dataset.layoutId, {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
            });
        });

        // Clear any existing globe instance
        if (globeInstance) {
            globeInstance.cleanup();
            globeInstance = null;
        }

        // In the updateGrid function, modify the globe creation part:
        if (activeFilter === 'LOCATION') {
            grid.innerHTML = '';
            grid.style.width = '100%';
            grid.style.height = '80vh';
            grid.style.position = 'relative';
            grid.style.overflow = 'hidden';
            grid.style.margin = 'auto';
            grid.style.marginTop = '2rem';

            // Store the globe instance globally
            globeInstance = createGlobe();
            grid.appendChild(globeInstance.renderer.domElement);
            
            globeInstance.animate();
            
            window.addEventListener('resize', globeInstance.resizeHandler);
            
            return;
        }

        // Reset styles for other views
        grid.style.width = '';
        grid.style.height = '';
        grid.style.position = '';
        grid.style.overflow = '';
        grid.style.margin = '';
        grid.style.marginTop = '';

        grid.innerHTML = '';

        // Rest of your existing updateGrid function...
        // (Include the rest of your grid layout logic here)
    }

    // Close search results when clicking outside
    document.addEventListener("click", function(event) {
        if (!event.target.closest(".search-tab") && !event.target.closest("#searchContent")) {
            mainSearchInput.classList.remove("visible");
            searchContent.style.display = "none";
        }
    });

    // Initialize the search icon functionality
    const searchTab = document.querySelector(".search-tab");
    searchTab.addEventListener("click", function(event) {
        if (event.target.closest(".search-icon")) {
            mainSearchInput.classList.toggle("visible");
            if (mainSearchInput.classList.contains("visible")) {
                mainSearchInput.focus();
            }
        }
    });

    // Add filter button event listeners
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            updateGrid(button.dataset.filter);
        });
    });

    // Initialize with default view
    updateGrid('CHRONOLOGICAL');
});
});
