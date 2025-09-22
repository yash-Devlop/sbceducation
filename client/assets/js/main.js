// sliders
$(function () {
    $('.banner-carousel').owlCarousel({
        loop: true,
        margin: 10,
        dots: false,
        nav: true,
        mouseDrag: false,
        autoplay: true,
        navText: ['<i class="fa-solid fa-arrow-left"></i>', '<i class="fa-solid fa-arrow-right"></i>' ],
        animateOut: 'slideOutUp',
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 1
            },
            1000: {
                items: 1
            }
        }
    });
})



// 
$(function () {
    $(window).scroll(function () {
        var windscroll = $(window).scrollTop();
        if (windscroll >= 100) {
            $('.sectionscroll').each(function (i) {
                if ($(this).position().top <= windscroll + -80) {
                    $('.scrolling-text').eq(i).addClass('active');
                } else {
                    $('.scrolling-text').eq(i).removeClass('active');
                }
            });
        } else {
            $('.scrolling-text').removeClass('active');
            $('.scrolling-text:first').addClass('active');
        }
    }).scroll();
})

// Service Slider
$(function () {
    function initializeSwiper(selector, options) {
        return new Swiper(selector, options);
    }

    let industrySwiper = initializeSwiper('.industrySlider', {
        loop: false,

        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        slidesPerView: 4.5,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        autoplay: {
            delay: 2000,
            disableOnInteraction: false,
        },
        pauseOnMouseEnter: true,
        disableOnInteraction: false,
        spaceBetween: 20,
        breakpoints: {
            1920: {
                slidesPerView: 4.5,
                spaceBetween: 20
            },
            1028: {
                slidesPerView: 3.5,
                spaceBetween: 20
            },
            480: {
                slidesPerView: 1,
                spaceBetween: 10
            }
        }
    });

    let clientSwiper = initializeSwiper('.clientSlider', {
        loop: false,
        navigation: {
            nextEl: '.swiper-button-next',
            prevEl: '.swiper-button-prev',
        },
        autoplay: {
            delay: 1,
            disableOnInteraction: true
        },
        speed: 2000,
        slidesPerView: 6,
        pagination: {
            el: '.swiper-pagination',
            clickable: true,
        },
        spaceBetween: 10,
        breakpoints: {
            1920: {
                slidesPerView: 6,
                spaceBetween: 10
            },
            1028: {
                slidesPerView: 6,
                spaceBetween: 10
            },
            480: {
                slidesPerView: 2,
                spaceBetween: 10
            }
        }
    });
});



// 
$(function () {
    $('.donationSlider').owlCarousel({
        loop: true,
        margin: 0,
        nav: true,
        navText: ["<i class='fa-solid fa-arrow-left'></i>","<i class='fa-solid fa-arrow-right'></i>"],
        dots: false,
        autoplay: true,
        autoplayTimeout: 3000,
        smartSpeed: 550,
        autoplayHoverPause: true,
        // animateIn: 'animate__fadeIn',
        // animateOut: 'animate__fadeOut',
        smartSpeed: 500,
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 2
            },
            1000: {
                items: 4
            }
        }
    })
})

// Important Linsks
$(function () {
    $('.ImpLinkCarousel').owlCarousel({
        loop: false,
        margin: 0,
        nav: false,
        // navText: ["<i class='fa-solid fa-arrow-left'></i>","<i class='fa-solid fa-arrow-right'></i>"],
        dots: false,
        autoplay: true,
        autoplayTimeout: 3000,
        smartSpeed: 550,
        autoplayHoverPause: true,
        // animateIn: 'animate__fadeIn',
        // animateOut: 'animate__fadeOut',
        smartSpeed: 500,
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 3
            },
            1000: {
                items: 5
            }
        }
    })
})
$(function () {
    $('.testimonialsCarousel').owlCarousel({
        loop: true,
        margin: 10,
        nav: false,
        dots: true,
        autoplay: true,
        // slideTransition: 'linear',
        autoplayTimeout: 7000,
        autoplaySpeed: 3000,
        smartSpeed: 550,
        autoplayHoverPause: true,
        // animateIn: 'animate__fadeIn',
        // animateOut: 'animate__fadeOut',
        smartSpeed: 500,
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 1
            },
            1000: {
                items: 2
            }
        }
    })
})
$(function () {
    $('.newscarousel').owlCarousel({
        loop: true,
        margin: 10,
        nav: false,
        dots: false,
        autoplay: true,
        // slideTransition: 'linear',
        autoplayTimeout: 4000,
        autoplaySpeed: 2000,
        smartSpeed: 550,
        autoplayHoverPause: true,
        // animateIn: 'animate__fadeIn',
        // animateOut: 'animate__fadeOut',
        smartSpeed: 500,
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 2
            },
            1000: {
                items: 3
            }
        }
    })
})
$(function () {
    $('.testimonialsCarousel').owlCarousel({
        loop: true,
        margin: 10,
        nav: false,
        dots: true,
        autoplay: true,
        // slideTransition: 'linear',
        autoplayTimeout: 3000,
        // autoplaySpeed: 4000,
        smartSpeed: 550,
        autoplayHoverPause: true,
        // animateIn: 'animate__fadeIn',
        // animateOut: 'animate__fadeOut',
        smartSpeed: 500,
        responsive: {
            0: {
                items: 1
            },
            600: {
                items: 1
            },
            1000: {
                items: 1
            }
        }
    })
})
$(function () {
    $('.clientsCarousel').owlCarousel({
        loop: true,
        margin: 15,
        nav: false,
        dots: false,
        autoplay: true,
        // slideTransition: 'linear',
        autoplayTimeout: 3000,
        // autoplaySpeed: 4000,
        smartSpeed: 550,
        autoplayHoverPause: true,
        // animateIn: 'animate__fadeIn',
        // animateOut: 'animate__fadeOut',
        smartSpeed: 500,
        responsive: {
            0: {
                items: 2
            },
            600: {
                items: 4
            },
            1000: {
                items: 6
            }
        }
    })
})

$(function () {
    const options = {
        background: {
            color: "transparent",
        },
        FullScreen: { enable: false, zIndex: 99 },
        interactivity: {
            events: {
                onClick: {
                    enable: true,
                    mode: "push",
                },
                onHover: {
                    enable: false,
                    mode: "repulse",
                }
            },
            modes: {
                push: {
                    quantity: 3,
                },
                repulse: {
                    distance: 100,
                },
            },
        },
        particles: {
            color: "#fff",
            links: {
                enable: true,
                opacity: 0.1,
                distance: 50,
                color: "#fff",
            },
            move: {
                enable: true,
                speed: { min: 1, max: 2 },
            },
            opacity: {
                value: { min: 0.1, max: 0.2 },
            },
            size: {
                value: { min: 1, max: 2 }
            },
        },
    }

    tsParticles.load("tsparticles", options);
})


// Menu Scrolling

$(document).ready(function () {
    var lastScrollTop = 0;

    $(window).scroll(function (event) {
        var st = $(this).scrollTop();
        if (st > lastScrollTop && st >= 100) {
            // downscroll code
            $('.headerSection').addClass('scroll-down').removeClass('scroll-up');
        } else {
            // upscroll code
            $('.headerSection').addClass('scroll-up').removeClass('scroll-down');
        }

        if (Math.abs($('.headerSection').offset().top) <= 1) {
            $('.headerSection').removeClass('scroll-down scroll-up');
        }

        lastScrollTop = st;
    });
});


// Header Responsive
$(function(){
  
var getBrowserWidth = function () {
    if (window.innerWidth < 768) {
      // Extra Small Device
      
      $(".hamburger").click(function () {
        $(".headerNav").each(function () {
          $(this).animate({
            height: "toggle"
          });
        });
        $(this).toggleClass('active');
      });

      $(".hasSub").click(function () {
        var dropDownMenu = $(this).closest('li.hasSub').find(".headerSubNav");

        dropDownMenu.animate({
          height: "toggle"
        });

        $(this).toggleClass('active');
      });



    }
  };

  getBrowserWidth();

  $(window).on('resize', function () {
    getBrowserWidth().animate('disabled', true);;

  });


//   sub Menu Btn
  $(document).ready(function() {
    function addPlusIcon() {
      $('.headerNav ul li.hasSub').each(function() {
        $(this).append('<i class="fa-solid fa-plus"></i>');
      });
    }
  
    function removePlusIcon() {
      $('li.hasSub i.fa-plus').remove();
    }
  
    function checkScreenWidth() {
      if ($(window).width() < 768) {
        addPlusIcon();
      } else {
        removePlusIcon();
      }
    }
  
    // Initial check
    checkScreenWidth();
  
    // Check again on window resize
    $(window).resize(function() {
      checkScreenWidth();
    });
  });
  
})
$(".hamburger").click(function () {
    $(this).toggleClass("is-active");
});


    // // Header Contact
    // $(function(){
    //     $(document).ready(function() {
    //         function addIcon(selector, iconClass) {
    //             $(selector).each(function() {
    //                 // Check screen size
    //                 if ($(window).width() < 768) {
    //                     // Empty the content of the span
    //                     $(this).empty();
    //                     // Add the icon
    //                     $(this).html('<i class="' + iconClass + '"></i>');
    //                 }
    //             });
    //         }
            
    //         // Call the addIcon function for '.headerContact'
    //         // addIcon('.defaultBtn .headerContact', 'fa-solid fa-comments');
            
    //         // Call the addIcon function for '.headerCareer'
    //         addIcon('.defaultBtn .headerCareer', 'fa-solid fa-user-tie');
            
    //         // Re-run addIcon on window resize
    //         $(window).resize(function() {
    //             // addIcon('.defaultBtn .headerContact', 'fa-solid fa-comments');
    //             addIcon('.defaultBtn .headerCareer', 'fa-solid fa-user-tie');
    //         });
    //     });
        
    // })


$(function () {

    // Top Button
    var btn = $('#button');

    $(window).scroll(function () {
        if ($(window).scrollTop() > 300) {
            btn.addClass('show');
        } else {
            btn.removeClass('show');
        }
    });

    btn.on('click', function (e) {
        e.preventDefault();
        $('html, body').animate({ scrollTop: 0 }, '300');
    });
})


// go to top with side bar nav
$(function(){
$(window).scroll(function() {
var windscroll = $(window).scrollTop();
if (windscroll >= 100) {
    $('.certiMainCard').each(function(i) {

        if ($(this).position().top <= windscroll + 140) {
            $('.sideScrollTopNav ul li.active').removeClass('active');
            $('.sideScrollTopNav ul li').eq(i).addClass('active');
        }
    });

} else {

    $('.sideScrollTopNav ul li.active').removeClass('active');
    $('.sideScrollTopNav ul li:first').addClass('active');
}

}).scroll();
$('.sidebar-button').click(function() {
    var target = $(this).data('target'); // Get the target section ID from data attribute
    $('html, body').animate({
      scrollTop: $(target).offset().top - 90 // Scroll to the top of the target section with an offset of 100px
    }, 1000); // Adjust the duration of the animation as needed
  });

})


$(function () {
    // Function to animate the counter
    function animateCounter(counterElement, finalValue, duration) {
      let start = parseInt(counterElement.textContent);
      const totalFrames = 120; // Total number of frames for the animation
      const increment = (finalValue - start) / totalFrames; // Calculate increment per frame

      // Function to update the counter value
      function updateCounter() {
        start += increment;
        counterElement.textContent = Math.floor(start);
        if ((increment > 0 && start < finalValue) || (increment < 0 && start > finalValue)) {
          requestAnimationFrame(updateCounter);
        }
      }

      updateCounter(); // Start the animation
    }

    // For each counter element, get its final value and start the animation
    $('.counter').each(function() {
      const finalValue = parseInt($(this).data('final-value'));
      animateCounter(this, finalValue, 5000); // Duration of 5 seconds
    });
  });


  $(function (){
    // $('.testiVideoSlider').owlCarousel({
    //     loop: true,
    //     margin: 1,
    //     nav: true,
    //     dots: false,
    //     autoplayHoverPause: true,
    //     navText: ['<i class="fa-solid fa-angles-left"></i>', '<i class="fa-solid fa-angles-right"></i>'],
    //     autoplay: true,
    //     smartSpeed: 3000,
    //     mouseDrag: false,
    //     touchDrag: false,
   
    //     autoplayTimeout: 5000,
    //     responsive: {
    //         0: {
    //             items: 1
    //         },
    //         600: {
    //             items: 1
    //         },
    //         1000: {
    //             items: 1
    //         }
    //     }
    // })

    
  })

  $(document).ready(function() {

    var sync1 = $("#sync1");
    var sync2 = $("#sync2");
    var slidesPerPage = 4; //globaly define number of elements per page
    var syncedSecondary = true;

    sync1.owlCarousel({
        items: 1,
        slideSpeed: 2000,
        nav: true,
        autoplay: false, 
        dots: false,
        loop: true,
        responsiveRefreshRate: 200,
        navText: ['<i class="fa-solid fa-arrow-left"></i>', '<i class="fa-solid fa-arrow-right"></i>'],
    }).on('changed.owl.carousel', syncPosition);

    sync2
        .on('initialized.owl.carousel', function() {
            sync2.find(".owl-item").eq(0).addClass("current");
        })
        .owlCarousel({
            items: slidesPerPage,
            dots: false,
            nav: false,
            smartSpeed: 200,
            slideSpeed: 500,
            slideBy: slidesPerPage, //alternatively you can slide by 1, this way the active slide will stick to the first item in the second carousel
            responsiveRefreshRate: 100
        }).on('changed.owl.carousel', syncPosition2);

    function syncPosition(el) {
        //if you set loop to false, you have to restore this next line
        //var current = el.item.index;

        //if you disable loop you have to comment this block
        var count = el.item.count - 1;
        var current = Math.round(el.item.index - (el.item.count / 2) - .5);

        if (current < 0) {
            current = count;
        }
        if (current > count) {
            current = 0;
        }

        //end block

        sync2
            .find(".owl-item")
            .removeClass("current")
            .eq(current)
            .addClass("current");
        var onscreen = sync2.find('.owl-item.active').length - 1;
        var start = sync2.find('.owl-item.active').first().index();
        var end = sync2.find('.owl-item.active').last().index();

        if (current > end) {
            sync2.data('owl.carousel').to(current, 100, true);
        }
        if (current < start) {
            sync2.data('owl.carousel').to(current - onscreen, 100, true);
        }
    }

    function syncPosition2(el) {
        if (syncedSecondary) {
            var number = el.item.index;
            sync1.data('owl.carousel').to(number, 100, true);
        }
    }

    sync2.on("click", ".owl-item", function(e) {
        e.preventDefault();
        var number = $(this).index();
        sync1.data('owl.carousel').to(number, 300, true);
    });

    
});

$(function () {
    // Select the logo image
    var logoImage = document.querySelector('img[alt="SBC Educational & wellfare services"]');

    // Function to change the image src based on the class
    function toggleLogoImage() {
        var header = document.querySelector(".headerSection");

        if (header.classList.contains("scroll-up") || header.classList.contains("scroll-down")) {
            // Set the logo to 'assets/img/logo.svg'
            logoImage.src = "assets/images/logo.svg";
        } else {
            // Set the logo to 'assets/img/logo-light.png'
            logoImage.src = "assets/images/logo-light.svg";
        }
    }

    // Listen for class changes on the header
    var observer = new MutationObserver(toggleLogoImage);
    observer.observe(document.querySelector(".headerSection"), {
        attributes: true,
        attributeFilter: ["class"],
    });

    // Initial check to set the correct logo on page load
    toggleLogoImage();
})


