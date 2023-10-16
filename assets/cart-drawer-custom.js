//Helper function
function debounceFunction(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
}

//Custom Drawer Element
class CartDrawerCustom extends HTMLElement {
    constructor() {
        super();
        
        this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
        const cartLink = document.querySelector('#cart-icon-bubble');
        cartLink.addEventListener('click', (event) => {
          event.preventDefault();
          this.open(cartLink);
        });
      } 
    
      open(triggeredBy) {
        setTimeout(() => {
          this.classList.add('animate', 'active');
        });
    
    
        document.body.classList.add('overflow-hidden');
      }
    
      close() {
        this.classList.remove('active');
        document.body.classList.remove('overflow-hidden');
      }
    
   
    
      renderContents(parsedState) {
        this.querySelector('.custom_drawer__inner').classList.contains('is-empty') &&
          this.querySelector('.custom_drawer__inner').classList.remove('is-empty');
        this.productId = parsedState.id;
        this.getSectionsToRender().forEach((section) => {
          const sectionElement = section.selector
            ? document.querySelector(section.selector)
            : document.getElementById(section.id);
          sectionElement.innerHTML = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
        });
    
        setTimeout(() => {
          this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
          this.open();
        });
      }
    
      getSectionInnerHTML(html, selector = '.shopify-section') {
        return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
      }
    
      getSectionsToRender() {
        return [
          {
            id: 'cart-drawer-custom',
            selector: '#CartDrawerCustom',
          },
          {
            id: 'cart-icon-bubble',
          },
        ];
      }
    
      getSectionDOM(html, selector = '.shopify-section') {
        return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
      }
    
      setActiveElement(element) {
        this.activeElement = element;
      }
}
customElements.define("cart-drawer-custom",CartDrawerCustom);


//Custom Cart Items Elements
class CartDrawerCustomItems extends HTMLElement {
    //constructor
  constructor() {
    super();
    //here we debounce the the onchange handler which triggers the updateQuantity Function
    const debouncedOnChange = debounceFunction((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);
    //here we add change event listener for any input iside the custom element it will trigger it
    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  //Pub sub logic for when the updatequantity(updates the ui ) finshes  it does nothing and when the publisher is outside it update the cart through
  //onCartUpdate because when inside the drawer it is only updatequantity that updates the ui
  cartUpdateUnsubscriber = undefined;
  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  // onchange event handler
  onChange(event) {
    this.updateQuantity(
      event.target.dataset.index,
      event.target.value,
      document.activeElement.getAttribute('name'),
      event.target.dataset.quantityVariantId
    );
  }

  //oncart update updates the ui that is triggered from a publisher outside the drawer
  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-CUSTOM-ITEMS') {
      fetch(`${routes.cart_url}?section_id=cart-drawer-custom`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-custom-items', '.footer_cart_drawer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {

      fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          this.innerHTML = sourceQty.innerHTML;
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }
  //sections that we will need to render or change when there is an update we need the information to target them
  //In the dom and replace them with html info comming from the server
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawerCustom',
        section: 'cart-drawer-custom',
        selector: '.cart_drawer_main_content_container',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }
  //line is the index of the element in the list
  updateQuantity(line, quantity, name, variantId) {
    //this function make the row or item inaccessble throught css pointer:none
    this.enableLoading(line);
    //this is the info we will send to the server
    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section), //here it return the html updated with the new update.
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        //here we get the current state.
        const parsedState = JSON.parse(state);
        //this function does the rendering
        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document.getElementById(section.id).querySelector(section.selector) || document.getElementById(section.id);
          elementToReplace.innerHTML = this.getSectionInnerHTML(
            parsedState.sections[section.section],
            section.selector
          );
          if(section.id === "CartDrawerCustom"){
            const html = new DOMParser().parseFromString(
              parsedState.sections[section.section],
              "text/html"
            );
            
            //Animate the loading progress
            const cart_shipping_spend = document.querySelector(".free_shipping_threshold_text").querySelector("h1");
            cart_shipping_spend.innerHTML = html.querySelector(".free_shipping_threshold_text").querySelector("h1").innerHTML;

            const cart_threshold = document.querySelector(".header_cart_drawer_container");
            console.log(cart_threshold.querySelector(".overlay_progress").style.width)
            setTimeout(function () {
              cart_threshold.querySelector(".overlay_progress").style.width =  html.querySelector(".overlay_progress").style.width;
            }, 500);
          }
        });
        
        //Here is the publish
        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-custom-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        //here we remove the loading overlay and we display the error from the server
        this.querySelectorAll('.loading-overlay').forEach((overlay) => overlay.classList.add('hidden'));
      })
      .finally(() => {
        //After all finish disable loading in the item row
        this.disableLoading(line);
      });
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.querySelector('cart-drawer-custom-items');
    mainCartItems.classList.add('cart__items__custom--disabled');


    document.activeElement.blur();
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.querySelector('cart-drawer-custom-items');
    mainCartItems.classList.remove('cart__items__custom--disabled');
  }
}
customElements.define("cart-drawer-custom-items",CartDrawerCustomItems);

//Custom Cart Items Remove Button
class CustomCartRemoveButton extends HTMLElement {
    constructor() {
        super();
        this.addEventListener('click', (event) => {
          event.preventDefault();
          const cartItems = this.closest('cart-items') || this.closest('cart-drawer-custom-items');
          cartItems.updateQuantity(this.dataset.index, 0);
        });
    }
}
customElements.define("custom-cart-remove-button",CustomCartRemoveButton);

 //Quantity Input Logic
class QuantityInputCustom extends HTMLElement {
    constructor() {
        super();
        //this is the input
        this.input = this.querySelector('input');
        //define change event that bubbles
        this.changeEvent = new Event('change', { bubbles: true });
        //add change event to input 
        this.input.addEventListener('change', this.onInputChange.bind(this));
        //every button clicke add click event
        this.querySelectorAll('button').forEach((button) =>
          button.addEventListener('click', this.onButtonClick.bind(this))
        );
      }
    
      quantityUpdateUnsubscriber = undefined;
    
      connectedCallback() {
        this.validateQtyRules();
        this.quantityUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.quantityUpdate, this.validateQtyRules.bind(this));
      }
    
      disconnectedCallback() {
        if (this.quantityUpdateUnsubscriber) {
          this.quantityUpdateUnsubscriber();
        }
      }
    
      onInputChange(event) {
        this.validateQtyRules();
      }
    
      onButtonClick(event) {
        event.preventDefault();
        const previousValue = this.input.value;
    
        event.target.name === 'plus' ? this.input.stepUp() : this.input.stepDown();
        if (previousValue !== this.input.value) this.input.dispatchEvent(this.changeEvent);
      }
    
      validateQtyRules() {
        const value = parseInt(this.input.value);
        if (this.input.min) {
          const min = parseInt(this.input.min);
          const buttonMinus = this.querySelector(".minus");
          buttonMinus.classList.toggle('disabled', value <= min);
        }
        if (this.input.max) {
          const max = parseInt(this.input.max);
          const buttonPlus = this.querySelector(".plus");
          buttonPlus.classList.toggle('disabled', value >= max);
        }
      }
  }
  
customElements.define('quantity-input-custom', QuantityInputCustom);